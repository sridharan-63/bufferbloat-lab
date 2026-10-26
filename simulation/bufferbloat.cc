#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <map>
#include <cmath>
#include <iomanip>
#include <filesystem>
#include <algorithm>

#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/internet-module.h"
#include "ns3/point-to-point-module.h"
#include "ns3/applications-module.h"
#include "ns3/traffic-control-module.h"
#include "ns3/flow-monitor-module.h"

using namespace ns3;
namespace fs = std::filesystem;

// ============================================================================
// Simulation Configuration Parameters
// ============================================================================
static std::string g_outputDir = "results/run_latest";
static uint32_t g_queueSize = 100;
static std::string g_queueType = "DropTail";
static double g_bottleneckBwMbps = 5.0;
static double g_bottleneckDelayMs = 35.0;
static double g_accessBwMbps = 100.0;
static double g_accessDelayMs = 2.0;
static uint32_t g_nClients = 3;
static std::string g_trafficLoad = "high";
static uint32_t g_packetSize = 1024;
static double g_simDuration = 15.0;
static uint32_t g_rngRun = 1;
static std::string g_tcpProtocol = "Cubic";
static uint32_t g_enableUdpFlow = 0;
static std::string g_udpRate = "1.5Mbps";

// Trace file streams
static std::ofstream g_rttFile;
static std::ofstream g_queueFile;
static std::ofstream g_throughputFile;
static std::ofstream g_dropFile;
static std::ofstream g_packetFile;

// Global tracking containers
static std::map<uint32_t, Time> g_probeSentTimes;
static std::vector<double> g_rttSamples;
static std::vector<double> g_baselineRttSamples;
static std::vector<double> g_loadedRttSamples;
static std::vector<double> g_queueOccupancySamples;
static std::vector<double> g_queueDelaySamples;
static std::vector<double> g_throughputSamples;

// Counters
static uint64_t g_totalRxBytes = 0;
static uint64_t g_prevRxBytes = 0;
static uint64_t g_totalTxPackets = 0;
static uint64_t g_totalRxPackets = 0;
static uint64_t g_totalDroppedPackets = 0;
static double g_latestSojournMs = 0.0;
static uint32_t g_maxQueueObserved = 0;
static double g_maxQueueDelayObserved = 0.0;

// Router QueueDisc reference pointer for event logging
static Ptr<QueueDisc> g_routerQueueDisc = nullptr;

// ============================================================================
// Trace Callbacks
// ============================================================================

void SojournTimeTrace(Time sojourn) {
    double ms = sojourn.GetSeconds() * 1000.0;
    g_latestSojournMs = ms;
    g_queueDelaySamples.push_back(ms);
    if (ms > g_maxQueueDelayObserved) {
        g_maxQueueDelayObserved = ms;
    }
}

void QueueEnqueueTrace(Ptr<const QueueDiscItem> item) {
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t uid = item->GetPacket()->GetUid();
    uint32_t size = item->GetPacket()->GetSize();
    uint32_t qDepth = g_routerQueueDisc ? g_routerQueueDisc->GetNPackets() : 0;

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << nowSec << ",ENQUEUE," << uid << "," << size << ","
                     << qDepth << ",RouterQueueDisc\n";
    }
}

void QueueDequeueTrace(Ptr<const QueueDiscItem> item) {
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t uid = item->GetPacket()->GetUid();
    uint32_t size = item->GetPacket()->GetSize();
    uint32_t qDepth = g_routerQueueDisc ? g_routerQueueDisc->GetNPackets() : 0;

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << nowSec << ",DEQUEUE," << uid << "," << size << ","
                     << qDepth << ",BottleneckTransmission\n";
    }
}

void QueueDropTrace(Ptr<const QueueDiscItem> item) {
    g_totalDroppedPackets++;
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t uid = item->GetPacket()->GetUid();
    uint32_t size = item->GetPacket()->GetSize();
    uint32_t qDepth = g_routerQueueDisc ? g_routerQueueDisc->GetNPackets() : 0;

    if (g_dropFile.is_open()) {
        g_dropFile << std::fixed << std::setprecision(5)
                   << nowSec << "," << g_totalDroppedPackets << ","
                   << uid << "," << size << ",QueueOverflow\n";
    }

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << nowSec << ",DROP," << uid << "," << size << ","
                     << qDepth << ",QueueOverflow\n";
    }
}

void MacTxTrace(Ptr<const Packet> packet) {
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t uid = packet->GetUid();
    uint32_t size = packet->GetSize();
    uint32_t qDepth = g_routerQueueDisc ? g_routerQueueDisc->GetNPackets() : 0;

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << nowSec << ",MAC_TX," << uid << "," << size << ","
                     << qDepth << ",BottleneckLinkTx\n";
    }
}

void MacRxTrace(Ptr<const Packet> packet) {
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t uid = packet->GetUid();
    uint32_t size = packet->GetSize();

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << nowSec << ",MAC_RX," << uid << "," << size << ","
                     << 0 << ",ServerLinkRx\n";
    }
}

void ProbeTxTrace(Ptr<const Packet> packet) {
    uint32_t uid = packet->GetUid();
    Time now = Simulator::Now();
    g_probeSentTimes[uid] = now;
    g_totalTxPackets++;

    if (g_packetFile.is_open()) {
        g_packetFile << std::fixed << std::setprecision(5)
                     << now.GetSeconds() << ",PROBE_TX," << uid << ","
                     << packet->GetSize() << ",0,ClientProbePing\n";
    }
}

void ProbeRxTrace(Ptr<const Packet> packet) {
    g_totalRxPackets++;
    uint32_t uid = packet->GetUid();
    auto it = g_probeSentTimes.find(uid);
    if (it != g_probeSentTimes.end()) {
        Time now = Simulator::Now();
        double rttMs = (now - it->second).GetSeconds() * 1000.0;
        double nowSec = now.GetSeconds();
        g_rttSamples.push_back(rttMs);

        // Before t = 2.0s, traffic is unloaded: measure true baseline RTT
        if (nowSec < 2.0) {
            g_baselineRttSamples.push_back(rttMs);
        } else {
            g_loadedRttSamples.push_back(rttMs);
        }

        if (g_rttFile.is_open()) {
            g_rttFile << std::fixed << std::setprecision(4)
                      << nowSec << "," << rttMs << ","
                      << g_rttSamples.size() - 1 << "," << uid << "\n";
        }

        if (g_packetFile.is_open()) {
            g_packetFile << std::fixed << std::setprecision(5)
                         << nowSec << ",PROBE_RX," << uid << ","
                         << packet->GetSize() << ",0,RTT=" << rttMs << "ms\n";
        }
        g_probeSentTimes.erase(it);
    }
}

void BulkTxTrace(Ptr<const Packet> packet) {
    g_totalTxPackets++;
}

void BulkRxTrace(Ptr<const Packet> packet, const Address& from) {
    (void)from;
    g_totalRxPackets++;
    g_totalRxBytes += packet->GetSize();
}

void UdpRxTrace(Ptr<const Packet> packet, const Address& from) {
    (void)from;
    g_totalRxPackets++;
    g_totalRxBytes += packet->GetSize();
}

// ============================================================================
// Periodic Sampling Monitors
// ============================================================================

void SampleQueue(Ptr<QueueDisc> queueDisc) {
    if (!queueDisc) return;
    double nowSec = Simulator::Now().GetSeconds();
    uint32_t qPackets = queueDisc->GetNPackets();
    uint32_t qBytes = queueDisc->GetNBytes();

    g_queueOccupancySamples.push_back(qPackets);
    if (qPackets > g_maxQueueObserved) {
        g_maxQueueObserved = qPackets;
    }

    if (g_queueFile.is_open()) {
        g_queueFile << std::fixed << std::setprecision(4)
                    << nowSec << "," << qPackets << "," << qBytes << ","
                    << g_latestSojournMs << "\n";
    }

    if (nowSec + 0.05 < g_simDuration) {
        Simulator::Schedule(MilliSeconds(50), &SampleQueue, queueDisc);
    }
}

void SampleThroughput(double intervalSec) {
    double nowSec = Simulator::Now().GetSeconds();
    uint64_t bytesInInterval = g_totalRxBytes - g_prevRxBytes;
    g_prevRxBytes = g_totalRxBytes;

    double throughputMbps = (bytesInInterval * 8.0) / (intervalSec * 1000000.0);
    g_throughputSamples.push_back(throughputMbps);

    if (g_throughputFile.is_open()) {
        g_throughputFile << std::fixed << std::setprecision(4)
                         << nowSec << "," << throughputMbps << "," << bytesInInterval << "\n";
    }

    if (nowSec + intervalSec < g_simDuration) {
        Simulator::Schedule(Seconds(intervalSec), &SampleThroughput, intervalSec);
    }
}

// ============================================================================
// Main Simulation
// ============================================================================

int main(int argc, char* argv[]) {
    CommandLine cmd(__FILE__);
    cmd.AddValue("nClients", "Number of client nodes", g_nClients);
    cmd.AddValue("bottleneckBw", "Bottleneck bandwidth (Mbps)", g_bottleneckBwMbps);
    cmd.AddValue("bottleneckDelay", "Bottleneck propagation delay (ms)", g_bottleneckDelayMs);
    cmd.AddValue("accessBw", "Access link bandwidth (Mbps)", g_accessBwMbps);
    cmd.AddValue("accessDelay", "Access link delay (ms)", g_accessDelayMs);
    cmd.AddValue("queueType", "Queue Discipline (DropTail, CoDel, RED, FqCoDel, PIE)", g_queueType);
    cmd.AddValue("queueSize", "Queue limit in packets", g_queueSize);
    cmd.AddValue("trafficLoad", "Traffic load (low, medium, high, udp_competing)", g_trafficLoad);
    cmd.AddValue("packetSize", "Packet payload size in bytes", g_packetSize);
    cmd.AddValue("simDuration", "Simulation duration in seconds", g_simDuration);
    cmd.AddValue("rngRun", "RNG run index / seed", g_rngRun);
    cmd.AddValue("tcpProtocol", "TCP variant (Cubic, NewReno, Bbr)", g_tcpProtocol);
    cmd.AddValue("enableUdp", "Enable competing UDP flow (0=off, 1=on)", g_enableUdpFlow);
    cmd.AddValue("udpRate", "Competing UDP flow rate", g_udpRate);
    cmd.AddValue("outputDir", "Output directory for CSV results", g_outputDir);
    cmd.Parse(argc, argv);

    // Sanitize and normalize inputs
    if (g_nClients < 1) g_nClients = 1;
    if (g_bottleneckBwMbps <= 0.0) g_bottleneckBwMbps = 5.0;
    if (g_bottleneckDelayMs <= 0.0) g_bottleneckDelayMs = 35.0;
    if (g_accessBwMbps <= 0.0) g_accessBwMbps = 100.0;
    if (g_accessDelayMs < 0.0) g_accessDelayMs = 2.0;
    if (g_queueSize < 1) g_queueSize = 100;
    if (g_packetSize < 64) g_packetSize = 1024;
    if (g_simDuration < 1.0) g_simDuration = 15.0;
    if (g_rngRun < 1) g_rngRun = 1;

    if (g_trafficLoad == "udp_competing" || g_trafficLoad == "competing_udp") {
        g_enableUdpFlow = 1;
    }

    // Set Random Seed and Run Index for deterministic, repeatable experiments
    SeedManager::SetSeed(1);
    SeedManager::SetRun(g_rngRun);

    // Create results directory
    fs::create_directories(g_outputDir);

    // Open trace files with complete CSV header definitions
    g_rttFile.open(g_outputDir + "/rtt_trace.csv");
    g_rttFile << "time_sec,rtt_ms,probe_seq,packet_uid\n";

    g_queueFile.open(g_outputDir + "/queue_trace.csv");
    g_queueFile << "time_sec,packets_in_queue,bytes_in_queue,queue_delay_ms\n";

    g_throughputFile.open(g_outputDir + "/throughput_trace.csv");
    g_throughputFile << "time_sec,throughput_mbps,bytes_in_window\n";

    g_dropFile.open(g_outputDir + "/drop_trace.csv");
    g_dropFile << "time_sec,drop_count,packet_uid,packet_size_bytes,reason\n";

    g_packetFile.open(g_outputDir + "/packet_trace.csv");
    g_packetFile << "time_sec,event,packet_uid,packet_size_bytes,queue_depth_pkts,details\n";

    // TCP configuration
    Config::SetDefault("ns3::TcpSocket::SegmentSize", UintegerValue(g_packetSize));
    Config::SetDefault("ns3::TcpSocket::SndBufSize", UintegerValue(4194304)); // 4MB buffer for high BDP
    Config::SetDefault("ns3::TcpSocket::RcvBufSize", UintegerValue(4194304));

    std::string tcpSocketType = "ns3::TcpCubic";
    if (g_tcpProtocol == "NewReno" || g_tcpProtocol == "newreno") {
        tcpSocketType = "ns3::TcpNewReno";
    } else if (g_tcpProtocol == "Bbr" || g_tcpProtocol == "bbr") {
        tcpSocketType = "ns3::TcpBbr";
    }
    Config::SetDefault("ns3::TcpL4Protocol::SocketType", StringValue(tcpSocketType));

    // 1. Create Nodes: N Clients, 1 Router, 1 Server (Dumbbell Topology)
    NodeContainer clients;
    clients.Create(g_nClients);

    Ptr<Node> router = CreateObject<Node>();
    Ptr<Node> server = CreateObject<Node>();

    // 2. Setup Point-to-Point Links
    // Access Links: Clients -> Router
    PointToPointHelper accessLink;
    accessLink.SetDeviceAttribute("DataRate", StringValue(std::to_string(g_accessBwMbps) + "Mbps"));
    accessLink.SetChannelAttribute("Delay", StringValue(std::to_string(g_accessDelayMs) + "ms"));

    std::vector<NetDeviceContainer> clientDevices(g_nClients);
    for (uint32_t i = 0; i < g_nClients; ++i) {
        clientDevices[i] = accessLink.Install(clients.Get(i), router);
    }

    // Bottleneck Link: Router -> Server
    PointToPointHelper bottleneckLink;
    bottleneckLink.SetDeviceAttribute("DataRate", StringValue(std::to_string(g_bottleneckBwMbps) + "Mbps"));
    bottleneckLink.SetChannelAttribute("Delay", StringValue(std::to_string(g_bottleneckDelayMs) + "ms"));
    // Set low internal NetDevice queue so that TrafficControl / QueueDisc handles the entire buffer
    bottleneckLink.SetQueue("ns3::DropTailQueue<Packet>", "MaxSize", QueueSizeValue(QueueSize("1p")));

    NetDeviceContainer bottleneckDevices = bottleneckLink.Install(router, server);

    // 3. Install Internet Stack
    InternetStackHelper stack;
    stack.Install(clients);
    stack.Install(router);
    stack.Install(server);

    // 4. Install Queue Discipline on Router Bottleneck Interface
    TrafficControlHelper tch;
    std::string qTypeUpper = g_queueType;
    for (auto &c : qTypeUpper) c = toupper(c);

    if (qTypeUpper == "CODEL") {
        tch.SetRootQueueDisc("ns3::CoDelQueueDisc",
                             "MaxSize", QueueSizeValue(QueueSize(QueueSizeUnit::PACKETS, g_queueSize)),
                             "Target", StringValue("5ms"),
                             "Interval", StringValue("100ms"));
    } else if (qTypeUpper == "RED") {
        tch.SetRootQueueDisc("ns3::RedQueueDisc",
                             "MaxSize", QueueSizeValue(QueueSize(QueueSizeUnit::PACKETS, g_queueSize)),
                             "MinTh", DoubleValue(std::max(5.0, g_queueSize * 0.2)),
                             "MaxTh", DoubleValue(std::max(15.0, g_queueSize * 0.8)));
    } else if (qTypeUpper == "FQCODEL" || qTypeUpper == "FQ-CODEL") {
        tch.SetRootQueueDisc("ns3::FqCoDelQueueDisc",
                             "MaxSize", QueueSizeValue(QueueSize(QueueSizeUnit::PACKETS, g_queueSize)));
    } else if (qTypeUpper == "PIE") {
        tch.SetRootQueueDisc("ns3::PieQueueDisc",
                             "MaxSize", QueueSizeValue(QueueSize(QueueSizeUnit::PACKETS, g_queueSize)));
    } else {
        // Default: DropTail (FIFO)
        tch.SetRootQueueDisc("ns3::FifoQueueDisc",
                             "MaxSize", QueueSizeValue(QueueSize(QueueSizeUnit::PACKETS, g_queueSize)));
    }

    QueueDiscContainer qdiscs = tch.Install(bottleneckDevices.Get(0));
    g_routerQueueDisc = qdiscs.Get(0);

    // Hook queue disc event traces
    g_routerQueueDisc->TraceConnectWithoutContext("Enqueue", MakeCallback(&QueueEnqueueTrace));
    g_routerQueueDisc->TraceConnectWithoutContext("Dequeue", MakeCallback(&QueueDequeueTrace));
    g_routerQueueDisc->TraceConnectWithoutContext("Drop", MakeCallback(&QueueDropTrace));
    g_routerQueueDisc->TraceConnectWithoutContext("SojournTime", MakeCallback(&SojournTimeTrace));

    // Hook bottleneck NetDevice physical layer traces
    bottleneckDevices.Get(0)->TraceConnectWithoutContext("MacTx", MakeCallback(&MacTxTrace));
    bottleneckDevices.Get(1)->TraceConnectWithoutContext("MacRx", MakeCallback(&MacRxTrace));

    // 5. Assign IP Addresses
    Ipv4AddressHelper ipv4;
    std::vector<Ipv4InterfaceContainer> clientInterfaces(g_nClients);
    for (uint32_t i = 0; i < g_nClients; ++i) {
        std::string subnet = "10.1." + std::to_string(i + 1) + ".0";
        ipv4.SetBase(Ipv4Address(subnet.c_str()), Ipv4Mask("255.255.255.0"));
        clientInterfaces[i] = ipv4.Assign(clientDevices[i]);
    }

    ipv4.SetBase("10.2.0.0", "255.255.255.0");
    Ipv4InterfaceContainer bottleneckInterfaces = ipv4.Assign(bottleneckDevices);
    Ipv4Address serverIp = bottleneckInterfaces.GetAddress(1);

    Ipv4GlobalRoutingHelper::PopulateRoutingTables();

    // 6. Server Sink Applications
    // TCP Sink for bulk data flows
    uint16_t tcpSinkPort = 8080;
    PacketSinkHelper tcpSink("ns3::TcpSocketFactory", InetSocketAddress(Ipv4Address::GetAny(), tcpSinkPort));
    ApplicationContainer tcpSinkApp = tcpSink.Install(server);
    tcpSinkApp.Start(Seconds(0.0));
    tcpSinkApp.Stop(Seconds(g_simDuration));

    Ptr<PacketSink> sinkPtr = DynamicCast<PacketSink>(tcpSinkApp.Get(0));
    if (sinkPtr) {
        sinkPtr->TraceConnectWithoutContext("Rx", MakeCallback(&BulkRxTrace));
    }

    // UDP Echo Server for high-precision latency probe
    uint16_t udpEchoPort = 9000;
    UdpEchoServerHelper echoServer(udpEchoPort);
    ApplicationContainer echoServerApp = echoServer.Install(server);
    echoServerApp.Start(Seconds(0.0));
    echoServerApp.Stop(Seconds(g_simDuration));

    // UDP Sink for competing UDP traffic (if enabled)
    uint16_t udpSinkPort = 9001;
    PacketSinkHelper udpSink("ns3::UdpSocketFactory", InetSocketAddress(Ipv4Address::GetAny(), udpSinkPort));
    ApplicationContainer udpSinkApp = udpSink.Install(server);
    udpSinkApp.Start(Seconds(0.0));
    udpSinkApp.Stop(Seconds(g_simDuration));

    Ptr<PacketSink> udpSinkPtr = DynamicCast<PacketSink>(udpSinkApp.Get(0));
    if (udpSinkPtr) {
        udpSinkPtr->TraceConnectWithoutContext("Rx", MakeCallback(&UdpRxTrace));
    }

    // 7. Client Applications
    // Client 0 always runs the high-precision RTT latency probe
    UdpEchoClientHelper echoClient(serverIp, udpEchoPort);
    echoClient.SetAttribute("MaxPackets", UintegerValue(1000000));
    echoClient.SetAttribute("Interval", TimeValue(MilliSeconds(50))); // 50ms probe interval
    echoClient.SetAttribute("PacketSize", UintegerValue(64));
    ApplicationContainer echoClientApp = echoClient.Install(clients.Get(0));
    echoClientApp.Start(Seconds(0.1));
    echoClientApp.Stop(Seconds(g_simDuration - 0.1));

    Ptr<UdpEchoClient> clientPtr = DynamicCast<UdpEchoClient>(echoClientApp.Get(0));
    if (clientPtr) {
        clientPtr->TraceConnectWithoutContext("Tx", MakeCallback(&ProbeTxTrace));
        clientPtr->TraceConnectWithoutContext("Rx", MakeCallback(&ProbeRxTrace));
    }

    // Bulk TCP Traffic Senders (creating congestion at the bottleneck)
    uint32_t activeSenders = 1;
    if (g_trafficLoad == "medium") {
        activeSenders = std::min(g_nClients, 2u);
    } else if (g_trafficLoad == "high" || g_trafficLoad == "udp_competing") {
        activeSenders = g_nClients;
    }

    double bulkStartTime = 2.0; // Starts at 2.0s to allow pure unloaded baseline RTT measurement first
    double bulkStopTime = g_simDuration - 0.2;

    for (uint32_t i = 0; i < activeSenders; ++i) {
        BulkSendHelper bulkSend("ns3::TcpSocketFactory", InetSocketAddress(serverIp, tcpSinkPort));
        bulkSend.SetAttribute("MaxBytes", UintegerValue(0)); // unlimited stream
        bulkSend.SetAttribute("SendSize", UintegerValue(g_packetSize));
        ApplicationContainer bulkApp = bulkSend.Install(clients.Get(i));
        bulkApp.Start(Seconds(bulkStartTime + i * 0.1));
        bulkApp.Stop(Seconds(bulkStopTime));

        Ptr<BulkSendApplication> bulkPtr = DynamicCast<BulkSendApplication>(bulkApp.Get(0));
        if (bulkPtr) {
            bulkPtr->TraceConnectWithoutContext("Tx", MakeCallback(&BulkTxTrace));
        }
    }

    // Competing UDP Flow (CBR stream competing with TCP Cubic for bottleneck bandwidth)
    if (g_enableUdpFlow && g_nClients >= 1) {
        uint32_t udpClientIdx = (g_nClients > 1) ? 1 : 0;
        OnOffHelper onOff("ns3::UdpSocketFactory", InetSocketAddress(serverIp, udpSinkPort));
        onOff.SetAttribute("OnTime", StringValue("ns3::ConstantRandomVariable[Constant=1.0]"));
        onOff.SetAttribute("OffTime", StringValue("ns3::ConstantRandomVariable[Constant=0.0]"));
        onOff.SetAttribute("DataRate", StringValue(g_udpRate));
        onOff.SetAttribute("PacketSize", UintegerValue(512));

        ApplicationContainer udpApp = onOff.Install(clients.Get(udpClientIdx));
        udpApp.Start(Seconds(bulkStartTime + 0.5));
        udpApp.Stop(Seconds(bulkStopTime));
    }

    // 8. Schedule periodic monitors
    Simulator::Schedule(MilliSeconds(50), &SampleQueue, g_routerQueueDisc);
    Simulator::Schedule(Seconds(0.2), &SampleThroughput, 0.2); // 200ms throughput window

    // 9. Install FlowMonitor to record actual flow-level statistics
    FlowMonitorHelper flowmon;
    Ptr<FlowMonitor> monitor = flowmon.InstallAll();

    // 10. Run Simulation
    Simulator::Stop(Seconds(g_simDuration));
    Simulator::Run();

    // Collect FlowMonitor statistics before Simulator::Destroy
    monitor->CheckForLostPackets();
    Ptr<Ipv4FlowClassifier> classifier = DynamicCast<Ipv4FlowClassifier>(flowmon.GetClassifier());
    std::map<FlowId, FlowMonitor::FlowStats> flowStats = monitor->GetFlowStats();

    // Export FlowMonitor CSV
    std::ofstream flowFile(g_outputDir + "/flow_stats.csv");
    flowFile << "flow_id,src_ip,src_port,dst_ip,dst_port,protocol,tx_packets,rx_packets,lost_packets,loss_ratio_percent,tx_bytes,rx_bytes,throughput_mbps,mean_delay_ms,mean_jitter_ms\n";

    for (const auto& [flowId, stat] : flowStats) {
        Ipv4FlowClassifier::FiveTuple t = classifier->FindFlow(flowId);
        double durationSec = (stat.timeLastRxPacket.GetSeconds() - stat.timeFirstTxPacket.GetSeconds());
        double tpMbps = (durationSec > 0.0) ? (stat.rxBytes * 8.0 / (durationSec * 1000000.0)) : 0.0;
        double meanDelayMs = (stat.rxPackets > 0) ? (stat.delaySum.GetSeconds() * 1000.0 / stat.rxPackets) : 0.0;
        double meanJitterMs = (stat.rxPackets > 1) ? (stat.jitterSum.GetSeconds() * 1000.0 / (stat.rxPackets - 1)) : 0.0;
        double lossPct = (stat.txPackets > 0) ? ((double)stat.lostPackets / (double)stat.txPackets * 100.0) : 0.0;

        std::string protoStr = (t.protocol == 6) ? "TCP" : (t.protocol == 17) ? "UDP" : std::to_string(t.protocol);

        flowFile << flowId << ","
                 << t.sourceAddress << "," << t.sourcePort << ","
                 << t.destinationAddress << "," << t.destinationPort << ","
                 << protoStr << ","
                 << stat.txPackets << "," << stat.rxPackets << ","
                 << stat.lostPackets << ","
                 << std::fixed << std::setprecision(2) << lossPct << ","
                 << stat.txBytes << "," << stat.rxBytes << ","
                 << std::fixed << std::setprecision(4) << tpMbps << ","
                 << std::fixed << std::setprecision(2) << meanDelayMs << ","
                 << std::fixed << std::setprecision(2) << meanJitterMs << "\n";
    }
    flowFile.close();

    // Export FlowMonitor XML
    monitor->SerializeToXmlFile(g_outputDir + "/flow_monitor.xml", true, true);

    Simulator::Destroy();

    // Close trace streams
    if (g_rttFile.is_open()) g_rttFile.close();
    if (g_queueFile.is_open()) g_queueFile.close();
    if (g_throughputFile.is_open()) g_throughputFile.close();
    if (g_dropFile.is_open()) g_dropFile.close();
    if (g_packetFile.is_open()) g_packetFile.close();

    // ========================================================================
    // 11. Compute Summary Metrics and Statistical KPIs
    // ========================================================================
    auto calcMean = [](const std::vector<double>& v) -> double {
        if (v.empty()) return 0.0;
        double sum = 0.0;
        for (double val : v) sum += val;
        return sum / v.size();
    };

    auto calcMin = [](const std::vector<double>& v) -> double {
        if (v.empty()) return 0.0;
        double m = v[0];
        for (double val : v) if (val < m) m = val;
        return m;
    };

    auto calcMax = [](const std::vector<double>& v) -> double {
        if (v.empty()) return 0.0;
        double m = v[0];
        for (double val : v) if (val > m) m = val;
        return m;
    };

    // Baseline RTT: Unloaded network state (0 to 2 seconds)
    double baselineRtt = calcMean(g_baselineRttSamples);
    if (baselineRtt <= 0.0) {
        // Theoretical baseline = 2 * (AccessDelay + BottleneckDelay) + Serialization
        baselineRtt = 2.0 * (g_accessDelayMs + g_bottleneckDelayMs);
    }

    // Loaded RTT: Under full concurrent traffic congestion
    double loadedRtt = calcMean(g_loadedRttSamples);
    if (loadedRtt <= 0.0) loadedRtt = baselineRtt;

    double peakRtt = calcMax(g_rttSamples);
    if (peakRtt < loadedRtt) peakRtt = loadedRtt;
    double minRtt = calcMin(g_rttSamples);
    if (minRtt <= 0.0) minRtt = baselineRtt;

    double rttIncreaseRatio = (baselineRtt > 0.0) ? (loadedRtt / baselineRtt) : 1.0;

    double avgQueueOccupancy = calcMean(g_queueOccupancySamples);
    double avgQueueDelay = calcMean(g_queueDelaySamples);
    double avgThroughput = calcMean(g_throughputSamples);
    double peakThroughput = calcMax(g_throughputSamples);

    double bottleneckUtilization = (g_bottleneckBwMbps > 0.0) ? ((avgThroughput / g_bottleneckBwMbps) * 100.0) : 0.0;
    if (bottleneckUtilization > 100.0) bottleneckUtilization = 100.0;

    double packetLossPercent = 0.0;
    if (g_totalTxPackets > 0) {
        packetLossPercent = ((double)g_totalDroppedPackets / (double)g_totalTxPackets) * 100.0;
    }

    // BufferBloat Detection Logic (Documented Thresholds)
    // Detection criterion:
    // 1. RTT loaded is at least 1.5x baseline RTT AND queueing delay >= 35ms, OR
    // 2. Peak RTT exceeds baseline RTT by more than 100ms
    bool bufferbloatDetected = (rttIncreaseRatio >= 1.5 && avgQueueDelay >= 35.0) ||
                               (peakRtt > baselineRtt + 100.0);

    // BufferBloat Grade (Industry standard like DSLReports/Waveform)
    // Extra latency added under load:
    double deltaRtt = std::max(0.0, loadedRtt - baselineRtt);
    std::string grade = "A+";
    if (deltaRtt < 10.0) {
        grade = "A+";
    } else if (deltaRtt < 30.0) {
        grade = "A";
    } else if (deltaRtt < 70.0) {
        grade = "B";
    } else if (deltaRtt < 150.0) {
        grade = "C";
    } else if (deltaRtt < 300.0) {
        grade = "D";
    } else {
        grade = "F";
    }

    // Write summary.csv with standard and compatibility alias keys
    std::ofstream summaryFile(g_outputDir + "/summary.csv");
    summaryFile << "metric,value,unit\n";
    summaryFile << "queue_type," << g_queueType << ",string\n";
    summaryFile << "queue_capacity_packets," << g_queueSize << ",packets\n";
    summaryFile << "queue_size_pkts," << g_queueSize << ",packets\n"; // Compatibility alias
    summaryFile << "bottleneck_bw_mbps," << std::fixed << std::setprecision(2) << g_bottleneckBwMbps << ",Mbps\n";
    summaryFile << "bottleneck_delay_ms," << std::fixed << std::setprecision(2) << g_bottleneckDelayMs << ",ms\n";
    summaryFile << "access_bw_mbps," << std::fixed << std::setprecision(2) << g_accessBwMbps << ",Mbps\n";
    summaryFile << "access_delay_ms," << std::fixed << std::setprecision(2) << g_accessDelayMs << ",ms\n";
    summaryFile << "num_clients," << g_nClients << ",nodes\n";
    summaryFile << "traffic_load," << g_trafficLoad << ",level\n";
    summaryFile << "tcp_protocol," << g_tcpProtocol << ",string\n";
    summaryFile << "competing_udp," << (g_enableUdpFlow ? "YES" : "NO") << ",flag\n";
    summaryFile << "sim_duration_sec," << std::fixed << std::setprecision(1) << g_simDuration << ",s\n";
    summaryFile << "baseline_rtt_ms," << std::fixed << std::setprecision(2) << baselineRtt << ",ms\n";
    summaryFile << "avg_loaded_rtt_ms," << std::fixed << std::setprecision(2) << loadedRtt << ",ms\n";
    summaryFile << "loaded_mean_rtt_ms," << std::fixed << std::setprecision(2) << loadedRtt << ",ms\n"; // Compatibility alias
    summaryFile << "peak_rtt_ms," << std::fixed << std::setprecision(2) << peakRtt << ",ms\n";
    summaryFile << "min_rtt_ms," << std::fixed << std::setprecision(2) << minRtt << ",ms\n";
    summaryFile << "rtt_increase_ratio," << std::fixed << std::setprecision(2) << rttIncreaseRatio << ",ratio\n";
    summaryFile << "bloat_ratio," << std::fixed << std::setprecision(2) << rttIncreaseRatio << ",ratio\n"; // Compatibility alias
    summaryFile << "avg_queue_occupancy_pkts," << std::fixed << std::setprecision(2) << avgQueueOccupancy << ",packets\n";
    summaryFile << "max_queue_occupancy_pkts," << g_maxQueueObserved << ",packets\n";
    summaryFile << "avg_queueing_delay_ms," << std::fixed << std::setprecision(2) << avgQueueDelay << ",ms\n";
    summaryFile << "max_queueing_delay_ms," << std::fixed << std::setprecision(2) << g_maxQueueDelayObserved << ",ms\n";
    summaryFile << "avg_throughput_mbps," << std::fixed << std::setprecision(2) << avgThroughput << ",Mbps\n";
    summaryFile << "mean_throughput_mbps," << std::fixed << std::setprecision(2) << avgThroughput << ",Mbps\n"; // Compatibility alias
    summaryFile << "peak_throughput_mbps," << std::fixed << std::setprecision(2) << peakThroughput << ",Mbps\n";
    summaryFile << "bottleneck_utilization_percent," << std::fixed << std::setprecision(2) << bottleneckUtilization << ",%\n";
    summaryFile << "total_packets_sent," << g_totalTxPackets << ",packets\n";
    summaryFile << "total_packets_received," << g_totalRxPackets << ",packets\n";
    summaryFile << "packets_dropped," << g_totalDroppedPackets << ",packets\n";
    summaryFile << "total_drops," << g_totalDroppedPackets << ",packets\n"; // Compatibility alias
    summaryFile << "packet_loss_percent," << std::fixed << std::setprecision(2) << packetLossPercent << ",%\n";
    summaryFile << "bufferbloat_detected," << (bufferbloatDetected ? "YES" : "NO") << ",flag\n";
    summaryFile << "bufferbloat_grade," << grade << ",grade\n";
    summaryFile << "grade," << grade << ",grade\n"; // Compatibility alias
    summaryFile.close();

    // Print summary to stdout for process controller / CLI
    std::cout << "=== NS-3 BufferBloat Simulation Completed Successfully ===" << std::endl;
    std::cout << "Queue Type: " << g_queueType << " | Buffer Size: " << g_queueSize << " pkts" << std::endl;
    std::cout << "Baseline RTT: " << baselineRtt << " ms | Loaded RTT: " << loadedRtt << " ms" << std::endl;
    std::cout << "Peak RTT: " << peakRtt << " ms | RTT Ratio: " << rttIncreaseRatio << "x" << std::endl;
    std::cout << "Avg Queueing Delay: " << avgQueueDelay << " ms | Peak Queueing Delay: " << g_maxQueueDelayObserved << " ms" << std::endl;
    std::cout << "Avg Throughput: " << avgThroughput << " Mbps | Utilization: " << bottleneckUtilization << "%" << std::endl;
    std::cout << "Packet Loss: " << packetLossPercent << "% (" << g_totalDroppedPackets << " dropped)" << std::endl;
    std::cout << "BufferBloat Detected: " << (bufferbloatDetected ? "YES" : "NO") << " | Grade: " << grade << std::endl;
    std::cout << "Results saved to: " << g_outputDir << std::endl;

    return 0;
}
