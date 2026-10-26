#define _GNU_SOURCE
#include "socket_server.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <errno.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <ctype.h>

ServerState g_server_state;
static int g_listen_fd = -1;

// Helper to sanitize path (prevent directory traversal)
static bool is_safe_filename(const char* str) {
    if (!str || strlen(str) == 0 || strlen(str) > 200) return false;
    if (strstr(str, "..") != NULL) return false;
    for (size_t i = 0; i < strlen(str); ++i) {
        char c = str[i];
        if (!isalnum(c) && c != '_' && c != '-' && c != '.' && c != '/') {
            return false;
        }
    }
    return true;
}

// Extract URL query param
static void get_query_param(const char* url, const char* key, char* out_val, size_t max_len) {
    out_val[0] = '\0';
    const char* q = strchr(url, '?');
    if (!q) return;
    q++;
    size_t klen = strlen(key);
    while (*q) {
        if (strncmp(q, key, klen) == 0 && q[klen] == '=') {
            q += klen + 1;
            size_t idx = 0;
            while (*q && *q != '&' && *q != ' ' && idx < max_len - 1) {
                out_val[idx++] = *q++;
            }
            out_val[idx] = '\0';
            return;
        }
        while (*q && *q != '&' && *q != ' ') q++;
        if (*q == '&') q++;
    }
}

// Simple JSON string parser for field
static void parse_json_str(const char* json, const char* key, char* out_val, size_t max_len) {
    out_val[0] = '\0';
    char needle[128];
    snprintf(needle, sizeof(needle), "\"%s\"", key);
    const char* p = strstr(json, needle);
    if (!p) return;
    p = strchr(p + strlen(needle), ':');
    if (!p) return;
    p++;
    while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') p++;
    if (*p == '\"') {
        p++;
        size_t idx = 0;
        while (*p && *p != '\"' && idx < max_len - 1) {
            out_val[idx++] = *p++;
        }
        out_val[idx] = '\0';
    } else {
        size_t idx = 0;
        while (*p && *p != ',' && *p != '}' && *p != ' ' && *p != '\r' && *p != '\n' && idx < max_len - 1) {
            out_val[idx++] = *p++;
        }
        out_val[idx] = '\0';
    }
}

static const char* get_mime_type(const char* path) {
    const char* dot = strrchr(path, '.');
    if (!dot) return "text/plain";
    if (strcmp(dot, ".html") == 0) return "text/html; charset=UTF-8";
    if (strcmp(dot, ".css") == 0) return "text/css; charset=UTF-8";
    if (strcmp(dot, ".js") == 0) return "application/javascript; charset=UTF-8";
    if (strcmp(dot, ".json") == 0) return "application/json; charset=UTF-8";
    if (strcmp(dot, ".csv") == 0) return "text/csv; charset=UTF-8";
    if (strcmp(dot, ".png") == 0) return "image/png";
    if (strcmp(dot, ".jpg") == 0 || strcmp(dot, ".jpeg") == 0) return "image/jpeg";
    if (strcmp(dot, ".svg") == 0) return "image/svg+xml";
    if (strcmp(dot, ".ico") == 0) return "image/x-icon";
    return "text/plain";
}

static void send_response(int client_fd, int status_code, const char* status_text, const char* content_type, const char* body, size_t body_len) {
    char header[1024];
    int header_len = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "\r\n",
        status_code, status_text, content_type, body_len);
    
    send(client_fd, header, header_len, 0);
    if (body && body_len > 0) {
        send(client_fd, body, body_len, 0);
    }
}

// Update simulation status
static void check_simulation_status(void) {
    if (!g_server_state.is_running) return;

    int status = 0;
    pid_t res = waitpid(g_server_state.current_pid, &status, WNOHANG);
    if (res == 0) {
        // Still running
        g_server_state.is_running = true;
    } else if (res == g_server_state.current_pid) {
        g_server_state.is_running = false;
        if (WIFEXITED(status)) {
            g_server_state.last_exit_code = WEXITSTATUS(status);
            if (g_server_state.last_exit_code == 0) {
                snprintf(g_server_state.status_message, sizeof(g_server_state.status_message),
                         "Simulation '%s' finished successfully", g_server_state.current_exp);
            } else {
                snprintf(g_server_state.status_message, sizeof(g_server_state.status_message),
                         "Simulation '%s' failed with exit code %d", g_server_state.current_exp, g_server_state.last_exit_code);
            }
        } else {
            g_server_state.last_exit_code = -1;
            snprintf(g_server_state.status_message, sizeof(g_server_state.status_message),
                     "Simulation terminated abnormally");
        }
    } else {
        // Child no longer exists
        g_server_state.is_running = false;
    }
}

// Handle GET /api/status
static void handle_api_status(int client_fd) {
    check_simulation_status();
    time_t now = time(NULL);
    int elapsed = g_server_state.is_running ? (int)(now - g_server_state.start_time) : 0;

    char resp[1024];
    int len = snprintf(resp, sizeof(resp),
        "{"
        "\"status\":\"ok\","
        "\"is_running\":%s,"
        "\"current_exp\":\"%s\","
        "\"elapsed_sec\":%d,"
        "\"last_exit_code\":%d,"
        "\"status_message\":\"%s\","
        "\"ns3_version\":\"3.46\","
        "\"supported_queues\":[\"DropTail\",\"CoDel\",\"RED\",\"FqCoDel\",\"PIE\"]"
        "}",
        g_server_state.is_running ? "true" : "false",
        g_server_state.current_exp,
        elapsed,
        g_server_state.last_exit_code,
        g_server_state.status_message
    );

    send_response(client_fd, 200, "OK", "application/json", resp, len);
}

// Validation helpers
static bool is_safe_basename(const char* str) {
    if (!str || strlen(str) == 0 || strlen(str) > 200) return false;
    if (strstr(str, "..") != NULL) return false;
    for (size_t i = 0; i < strlen(str); ++i) {
        char c = str[i];
        if (!isalnum(c) && c != '_' && c != '-' && c != '.') {
            return false;
        }
    }
    return true;
}

static bool is_allowed_file_extension(const char* path) {
    const char* dot = strrchr(path, '.');
    if (!dot) return false;
    return (strcmp(dot, ".csv") == 0 ||
            strcmp(dot, ".xml") == 0 ||
            strcmp(dot, ".json") == 0 ||
            strcmp(dot, ".txt") == 0 ||
            strcmp(dot, ".log") == 0);
}

static bool normalize_queue_type(const char* input, char* out_val, size_t max_len) {
    if (!input || strlen(input) == 0) {
        snprintf(out_val, max_len, "DropTail");
        return true;
    }
    if (strcasecmp(input, "DropTail") == 0 || strcasecmp(input, "Fifo") == 0) {
        snprintf(out_val, max_len, "DropTail");
        return true;
    } else if (strcasecmp(input, "CoDel") == 0) {
        snprintf(out_val, max_len, "CoDel");
        return true;
    } else if (strcasecmp(input, "RED") == 0) {
        snprintf(out_val, max_len, "RED");
        return true;
    } else if (strcasecmp(input, "FqCoDel") == 0 || strcasecmp(input, "FQ-CoDel") == 0) {
        snprintf(out_val, max_len, "FqCoDel");
        return true;
    } else if (strcasecmp(input, "PIE") == 0) {
        snprintf(out_val, max_len, "PIE");
        return true;
    }
    return false;
}

// Handle POST /api/simulate
static void handle_api_simulate(int client_fd, const char* body) {
    check_simulation_status();

    if (g_server_state.is_running) {
        const char* err = "{\"error\":\"Simulation is currently running. Please wait for it to complete.\"}";
        send_response(client_fd, 409, "Conflict", "application/json", err, strlen(err));
        return;
    }

    // Verify simulation executable exists and is executable
    if (access(g_server_state.sim_bin, X_OK) != 0) {
        const char* err = "{\"error\":\"Simulation executable not found or not executable. Please run 'make simulation/bufferbloat'.\"}";
        send_response(client_fd, 500, "Internal Server Error", "application/json", err, strlen(err));
        return;
    }

    char raw_queue_type[32] = "DropTail";
    char queue_type[32] = "DropTail";
    char queue_size[16] = "100";
    char bottleneck_bw[16] = "5.0";
    char bottleneck_delay[16] = "35.0";
    char access_bw[16] = "100.0";
    char access_delay[16] = "2.0";
    char n_clients[16] = "3";
    char traffic_load[32] = "high";
    char packet_size[16] = "1024";
    char sim_duration[16] = "15.0";
    char rng_run[16] = "1";
    char tcp_proto[32] = "Cubic";
    char enable_udp[16] = "0";
    char exp_name[MAX_EXP_NAME] = "";

    parse_json_str(body, "queueType", raw_queue_type, sizeof(raw_queue_type));
    parse_json_str(body, "queueSize", queue_size, sizeof(queue_size));
    parse_json_str(body, "bottleneckBw", bottleneck_bw, sizeof(bottleneck_bw));
    parse_json_str(body, "bottleneckDelay", bottleneck_delay, sizeof(bottleneck_delay));
    parse_json_str(body, "accessBw", access_bw, sizeof(access_bw));
    parse_json_str(body, "accessDelay", access_delay, sizeof(access_delay));
    parse_json_str(body, "nClients", n_clients, sizeof(n_clients));
    parse_json_str(body, "trafficLoad", traffic_load, sizeof(traffic_load));
    parse_json_str(body, "packetSize", packet_size, sizeof(packet_size));
    parse_json_str(body, "simDuration", sim_duration, sizeof(sim_duration));
    parse_json_str(body, "rngRun", rng_run, sizeof(rng_run));
    parse_json_str(body, "tcpProtocol", tcp_proto, sizeof(tcp_proto));
    parse_json_str(body, "enableUdp", enable_udp, sizeof(enable_udp));
    parse_json_str(body, "expName", exp_name, sizeof(exp_name));

    // Fallback defaults if empty strings provided
    if (strlen(queue_size) == 0) snprintf(queue_size, sizeof(queue_size), "100");
    if (strlen(bottleneck_bw) == 0) snprintf(bottleneck_bw, sizeof(bottleneck_bw), "5.0");
    if (strlen(bottleneck_delay) == 0) snprintf(bottleneck_delay, sizeof(bottleneck_delay), "35.0");
    if (strlen(access_bw) == 0) snprintf(access_bw, sizeof(access_bw), "100.0");
    if (strlen(access_delay) == 0) snprintf(access_delay, sizeof(access_delay), "2.0");
    if (strlen(n_clients) == 0) snprintf(n_clients, sizeof(n_clients), "3");
    if (strlen(traffic_load) == 0) snprintf(traffic_load, sizeof(traffic_load), "high");
    if (strlen(packet_size) == 0) snprintf(packet_size, sizeof(packet_size), "1024");
    if (strlen(sim_duration) == 0) snprintf(sim_duration, sizeof(sim_duration), "15.0");
    if (strlen(rng_run) == 0) snprintf(rng_run, sizeof(rng_run), "1");
    if (strlen(tcp_proto) == 0) snprintf(tcp_proto, sizeof(tcp_proto), "Cubic");

    // Strict validation of queue type
    if (!normalize_queue_type(raw_queue_type, queue_type, sizeof(queue_type))) {
        char err[256];
        snprintf(err, sizeof(err), "{\"error\":\"Invalid queueType '%s'. Supported: DropTail, CoDel, RED, FqCoDel, PIE\"}", raw_queue_type);
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    // Strict validation of numeric parameters
    int q_size = atoi(queue_size);
    if (q_size < 1 || q_size > 10000) {
        const char* err = "{\"error\":\"Invalid queueSize. Must be integer between 1 and 10000.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    double bot_bw = atof(bottleneck_bw);
    if (bot_bw <= 0.0 || bot_bw > 1000.0) {
        const char* err = "{\"error\":\"Invalid bottleneckBw. Must be between 0.1 and 1000.0 Mbps.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    double bot_delay = atof(bottleneck_delay);
    if (bot_delay < 0.0 || bot_delay > 5000.0) {
        const char* err = "{\"error\":\"Invalid bottleneckDelay. Must be between 0.0 and 5000.0 ms.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    double acc_bw = atof(access_bw);
    if (acc_bw <= 0.0 || acc_bw > 10000.0) {
        const char* err = "{\"error\":\"Invalid accessBw. Must be between 0.1 and 10000.0 Mbps.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    double acc_delay = atof(access_delay);
    if (acc_delay < 0.0 || acc_delay > 1000.0) {
        const char* err = "{\"error\":\"Invalid accessDelay. Must be between 0.0 and 1000.0 ms.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    int clients = atoi(n_clients);
    if (clients < 1 || clients > 50) {
        const char* err = "{\"error\":\"Invalid nClients. Must be integer between 1 and 50.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    int pkt_size = atoi(packet_size);
    if (pkt_size < 64 || pkt_size > 65535) {
        const char* err = "{\"error\":\"Invalid packetSize. Must be integer between 64 and 65535 bytes.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    double duration = atof(sim_duration);
    if (duration < 0.5 || duration > 300.0) {
        const char* err = "{\"error\":\"Invalid simDuration. Must be between 0.5 and 300.0 seconds.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    int rng = atoi(rng_run);
    if (rng < 1 || rng > 1000000) {
        const char* err = "{\"error\":\"Invalid rngRun. Must be positive integer.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    // Validate trafficLoad
    if (strcmp(traffic_load, "low") != 0 &&
        strcmp(traffic_load, "medium") != 0 &&
        strcmp(traffic_load, "high") != 0 &&
        strcmp(traffic_load, "udp_competing") != 0 &&
        strcmp(traffic_load, "competing_udp") != 0) {
        const char* err = "{\"error\":\"Invalid trafficLoad. Must be low, medium, high, or udp_competing.\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    // Validate expName if provided
    if (strlen(exp_name) > 0) {
        if (!is_safe_basename(exp_name)) {
            const char* err = "{\"error\":\"Invalid expName: only alphanumeric characters, underscores, hyphens, and dots allowed.\"}";
            send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
            return;
        }
    } else {
        time_t t = time(NULL);
        struct tm tm_buf;
        localtime_r(&t, &tm_buf);
        snprintf(exp_name, sizeof(exp_name), "run_%04d%02d%02d_%02d%02d%02d_%s",
                 tm_buf.tm_year + 1900, tm_buf.tm_mon + 1, tm_buf.tm_mday,
                 tm_buf.tm_hour, tm_buf.tm_min, tm_buf.tm_sec, queue_type);
    }

    // Target directory: results/<exp_name>
    char target_dir[2048];
    snprintf(target_dir, sizeof(target_dir), "%s/%s", g_server_state.results_dir, exp_name);

    pid_t pid = fork();
    if (pid < 0) {
        const char* err = "{\"error\":\"Failed to fork process\"}";
        send_response(client_fd, 500, "Internal Server Error", "application/json", err, strlen(err));
        return;
    }

    if (pid == 0) {
        // Child process
        char arg_clients[64], arg_bot_bw[64], arg_bot_del[64];
        char arg_acc_bw[64], arg_acc_del[64], arg_qtype[64], arg_qsize[64];
        char arg_load[64], arg_pktsize[64], arg_dur[64], arg_rng[64];
        char arg_tcp[64], arg_udp[64], arg_outdir[2100];

        snprintf(arg_clients, sizeof(arg_clients), "--nClients=%d", clients);
        snprintf(arg_bot_bw, sizeof(arg_bot_bw), "--bottleneckBw=%.2f", bot_bw);
        snprintf(arg_bot_del, sizeof(arg_bot_del), "--bottleneckDelay=%.2f", bot_delay);
        snprintf(arg_acc_bw, sizeof(arg_acc_bw), "--accessBw=%.2f", acc_bw);
        snprintf(arg_acc_del, sizeof(arg_acc_del), "--accessDelay=%.2f", acc_delay);
        snprintf(arg_qtype, sizeof(arg_qtype), "--queueType=%s", queue_type);
        snprintf(arg_qsize, sizeof(arg_qsize), "--queueSize=%d", q_size);
        snprintf(arg_load, sizeof(arg_load), "--trafficLoad=%s", traffic_load);
        snprintf(arg_pktsize, sizeof(arg_pktsize), "--packetSize=%d", pkt_size);
        snprintf(arg_dur, sizeof(arg_dur), "--simDuration=%.1f", duration);
        snprintf(arg_rng, sizeof(arg_rng), "--rngRun=%d", rng);
        snprintf(arg_tcp, sizeof(arg_tcp), "--tcpProtocol=%s", tcp_proto);
        snprintf(arg_udp, sizeof(arg_udp), "--enableUdp=%s", (strcmp(traffic_load, "udp_competing") == 0 || atoi(enable_udp) > 0) ? "1" : "0");
        snprintf(arg_outdir, sizeof(arg_outdir), "--outputDir=%s", target_dir);

        char* argv[] = {
            g_server_state.sim_bin,
            arg_clients,
            arg_bot_bw,
            arg_bot_del,
            arg_acc_bw,
            arg_acc_del,
            arg_qtype,
            arg_qsize,
            arg_load,
            arg_pktsize,
            arg_dur,
            arg_rng,
            arg_tcp,
            arg_udp,
            arg_outdir,
            NULL
        };

        // Redirect child output to log file
        char log_path[2048];
        snprintf(log_path, sizeof(log_path), "%s/sim.log", g_server_state.results_dir);
        int log_fd = open(log_path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (log_fd >= 0) {
            dup2(log_fd, STDOUT_FILENO);
            dup2(log_fd, STDERR_FILENO);
            close(log_fd);
        }

        execv(g_server_state.sim_bin, argv);
        perror("execv failed");
        exit(127);
    }

    // Parent process
    g_server_state.current_pid = pid;
    g_server_state.is_running = true;
    g_server_state.start_time = time(NULL);
    strncpy(g_server_state.current_exp, exp_name, sizeof(g_server_state.current_exp));
    snprintf(g_server_state.status_message, sizeof(g_server_state.status_message),
             "Running simulation '%s' (PID %d)...", exp_name, pid);

    char resp[512];
    int len = snprintf(resp, sizeof(resp),
        "{\"status\":\"started\",\"exp_name\":\"%s\",\"pid\":%d,\"queueType\":\"%s\"}",
        exp_name, pid, queue_type);
    send_response(client_fd, 200, "OK", "application/json", resp, len);
}

// Handle GET /api/results (List all experiments)
static void handle_api_results(int client_fd) {
    DIR* dir = opendir(g_server_state.results_dir);
    if (!dir) {
        const char* empty = "[]";
        send_response(client_fd, 200, "OK", "application/json", empty, strlen(empty));
        return;
    }

    char* buffer = malloc(BUFFER_SIZE * 4);
    if (!buffer) {
        closedir(dir);
        send_response(client_fd, 500, "Error", "application/json", "[]", 2);
        return;
    }

    int offset = snprintf(buffer, BUFFER_SIZE * 4, "[");
    bool first = true;

    struct dirent* entry;
    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] == '.') continue;
        char subpath[2048];
        snprintf(subpath, sizeof(subpath), "%s/%s/summary.csv", g_server_state.results_dir, entry->d_name);

        FILE* f = fopen(subpath, "r");
        if (!f) continue;

        // Parse summary.csv into JSON object
        char line[256];
        char qtype[64] = "", qcap[64] = "", bot_bw[64] = "", rtt_loaded[64] = "", base_rtt[64] = "";
        char avg_tp[64] = "", loss[64] = "", bloat[64] = "", grade[64] = "", qdelay[64] = "";

        // Read lines: metric,value,unit
        while (fgets(line, sizeof(line), f)) {
            char metric[64], val[64], unit[32];
            if (sscanf(line, "%63[^,],%63[^,],%31[^\r\n]", metric, val, unit) >= 2) {
                if (strcmp(metric, "queue_type") == 0) snprintf(qtype, sizeof(qtype), "%s", val);
                else if (strcmp(metric, "queue_capacity_packets") == 0 || strcmp(metric, "queue_size_pkts") == 0) snprintf(qcap, sizeof(qcap), "%s", val);
                else if (strcmp(metric, "bottleneck_bw_mbps") == 0) snprintf(bot_bw, sizeof(bot_bw), "%s", val);
                else if (strcmp(metric, "baseline_rtt_ms") == 0) snprintf(base_rtt, sizeof(base_rtt), "%s", val);
                else if (strcmp(metric, "avg_loaded_rtt_ms") == 0 || strcmp(metric, "loaded_mean_rtt_ms") == 0) snprintf(rtt_loaded, sizeof(rtt_loaded), "%s", val);
                else if (strcmp(metric, "avg_queueing_delay_ms") == 0) snprintf(qdelay, sizeof(qdelay), "%s", val);
                else if (strcmp(metric, "avg_throughput_mbps") == 0 || strcmp(metric, "mean_throughput_mbps") == 0) snprintf(avg_tp, sizeof(avg_tp), "%s", val);
                else if (strcmp(metric, "packet_loss_percent") == 0) snprintf(loss, sizeof(loss), "%s", val);
                else if (strcmp(metric, "bufferbloat_detected") == 0) snprintf(bloat, sizeof(bloat), "%s", val);
                else if (strcmp(metric, "bufferbloat_grade") == 0 || strcmp(metric, "grade") == 0) snprintf(grade, sizeof(grade), "%s", val);
            }
        }
        fclose(f);

        if (!first) {
            offset += snprintf(buffer + offset, (BUFFER_SIZE * 4) - offset, ",");
        }
        first = false;

        offset += snprintf(buffer + offset, (BUFFER_SIZE * 4) - offset,
            "{"
            "\"id\":\"%s\","
            "\"queue_type\":\"%s\","
            "\"queue_capacity\":%s,"
            "\"bottleneck_bw\":%s,"
            "\"baseline_rtt_ms\":%s,"
            "\"avg_loaded_rtt_ms\":%s,"
            "\"avg_queueing_delay_ms\":%s,"
            "\"avg_throughput_mbps\":%s,"
            "\"packet_loss_percent\":%s,"
            "\"bufferbloat_detected\":\"%s\","
            "\"grade\":\"%s\""
            "}",
            entry->d_name, qtype,
            qcap[0] ? qcap : "0",
            bot_bw[0] ? bot_bw : "0",
            base_rtt[0] ? base_rtt : "0",
            rtt_loaded[0] ? rtt_loaded : "0",
            qdelay[0] ? qdelay : "0",
            avg_tp[0] ? avg_tp : "0",
            loss[0] ? loss : "0",
            bloat[0] ? bloat : "NO",
            grade[0] ? grade : "N/A"
        );
    }
    closedir(dir);

    snprintf(buffer + offset, (BUFFER_SIZE * 4) - offset, "]");
    send_response(client_fd, 200, "OK", "application/json", buffer, strlen(buffer));
    free(buffer);
}

// Handle GET /api/data?exp=...&file=...
static void handle_api_data(int client_fd, const char* url) {
    char exp[MAX_EXP_NAME] = "";
    char file[64] = "";
    get_query_param(url, "exp", exp, sizeof(exp));
    get_query_param(url, "file", file, sizeof(file));

    if (!is_safe_filename(exp) || !is_safe_basename(file) || !is_allowed_file_extension(file)) {
        const char* err = "{\"error\":\"Invalid experiment or filename parameter\"}";
        send_response(client_fd, 400, "Bad Request", "application/json", err, strlen(err));
        return;
    }

    char filepath[2048];
    snprintf(filepath, sizeof(filepath), "%s/%s/%s", g_server_state.results_dir, exp, file);

    int fd = open(filepath, O_RDONLY);
    if (fd < 0) {
        const char* err = "{\"error\":\"File not found\"}";
        send_response(client_fd, 404, "Not Found", "application/json", err, strlen(err));
        return;
    }

    struct stat st;
    fstat(fd, &st);
    size_t file_size = st.st_size;

    char* file_data = malloc(file_size + 1);
    if (!file_data) {
        close(fd);
        send_response(client_fd, 500, "Internal Server Error", "application/json", "{}", 2);
        return;
    }

    ssize_t bytes_read = read(fd, file_data, file_size);
    close(fd);
    if (bytes_read >= 0) {
        file_data[bytes_read] = '\0';
    }

    send_response(client_fd, 200, "OK", get_mime_type(filepath), file_data, bytes_read);
    free(file_data);
}

// Serve static frontend files
static void handle_static_file(int client_fd, const char* path) {
    char clean_path[2048];
    if (strcmp(path, "/") == 0) {
        snprintf(clean_path, sizeof(clean_path), "%s/index.html", g_server_state.web_root);
    } else {
        // Strip query string if present
        char tmp[MAX_PATH_LEN];
        strncpy(tmp, path, sizeof(tmp));
        char* q = strchr(tmp, '?');
        if (q) *q = '\0';

        if (!is_safe_filename(tmp)) {
            const char* err = "400 Bad Request";
            send_response(client_fd, 400, "Bad Request", "text/plain", err, strlen(err));
            return;
        }
        snprintf(clean_path, sizeof(clean_path), "%s%s", g_server_state.web_root, tmp);
    }

    int fd = open(clean_path, O_RDONLY);
    if (fd < 0) {
        // Fallback to index.html for Single Page Application client-side routing
        snprintf(clean_path, sizeof(clean_path), "%s/index.html", g_server_state.web_root);
        fd = open(clean_path, O_RDONLY);
        if (fd < 0) {
            const char* err = "404 Not Found";
            send_response(client_fd, 404, "Not Found", "text/plain", err, strlen(err));
            return;
        }
    }

    struct stat st;
    fstat(fd, &st);
    size_t file_size = st.st_size;

    char* file_data = malloc(file_size + 1);
    if (!file_data) {
        close(fd);
        send_response(client_fd, 500, "Internal Server Error", "text/plain", "Error", 5);
        return;
    }

    ssize_t bytes_read = read(fd, file_data, file_size);
    close(fd);

    send_response(client_fd, 200, "OK", get_mime_type(clean_path), file_data, bytes_read);
    free(file_data);
}

static void handle_client(int client_fd) {
    char req_buf[BUFFER_SIZE];
    ssize_t n = recv(client_fd, req_buf, sizeof(req_buf) - 1, 0);
    if (n <= 0) {
        close(client_fd);
        return;
    }
    req_buf[n] = '\0';

    char method[16], url[MAX_PATH_LEN], proto[16];
    if (sscanf(req_buf, "%15s %511s %15s", method, url, proto) < 3) {
        close(client_fd);
        return;
    }

    // Handle CORS preflight
    if (strcmp(method, "OPTIONS") == 0) {
        send_response(client_fd, 200, "OK", "text/plain", "", 0);
        close(client_fd);
        return;
    }

    // Find body start
    char* body = strstr(req_buf, "\r\n\r\n");
    if (body) {
        body += 4;
        // Check if there is Content-Length to read remainder of body
        const char* cl = strcasestr(req_buf, "Content-Length:");
        if (cl) {
            size_t expected_len = atol(cl + 15);
            size_t body_so_far = n - (body - req_buf);
            while (body_so_far < expected_len && n < (ssize_t)sizeof(req_buf) - 1) {
                ssize_t r = recv(client_fd, req_buf + n, sizeof(req_buf) - 1 - n, 0);
                if (r <= 0) break;
                n += r;
                req_buf[n] = '\0';
                body_so_far += r;
            }
        }
    } else {
        body = "";
    }

    if (strcmp(method, "GET") == 0) {
        if (strncmp(url, "/api/status", 11) == 0) {
            handle_api_status(client_fd);
        } else if (strncmp(url, "/api/results", 12) == 0) {
            handle_api_results(client_fd);
        } else if (strncmp(url, "/api/data", 9) == 0) {
            handle_api_data(client_fd, url);
        } else {
            handle_static_file(client_fd, url);
        }
    } else if (strcmp(method, "POST") == 0) {
        if (strncmp(url, "/api/simulate", 13) == 0) {
            handle_api_simulate(client_fd, body);
        } else {
            const char* not_found = "{\"error\":\"Unknown POST endpoint\"}";
            send_response(client_fd, 404, "Not Found", "application/json", not_found, strlen(not_found));
        }
    } else {
        const char* err = "Method Not Allowed";
        send_response(client_fd, 405, "Method Not Allowed", "text/plain", err, strlen(err));
    }

    close(client_fd);
}

int init_server(int port, const char* web_root, const char* results_dir, const char* sim_bin) {
    memset(&g_server_state, 0, sizeof(g_server_state));
    g_server_state.port = port;
    snprintf(g_server_state.web_root, sizeof(g_server_state.web_root), "%s", web_root);
    snprintf(g_server_state.results_dir, sizeof(g_server_state.results_dir), "%s", results_dir);
    snprintf(g_server_state.sim_bin, sizeof(g_server_state.sim_bin), "%s", sim_bin);
    g_server_state.current_pid = -1;
    g_server_state.is_running = false;
    snprintf(g_server_state.status_message, sizeof(g_server_state.status_message), "%s", "Ready");

    // Ensure results dir exists
    mkdir(results_dir, 0755);

    g_listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (g_listen_fd < 0) {
        perror("socket failed");
        return -1;
    }

    int opt = 1;
    setsockopt(g_listen_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);

    if (bind(g_listen_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind failed");
        close(g_listen_fd);
        g_listen_fd = -1;
        return -1;
    }

    if (listen(g_listen_fd, 32) < 0) {
        perror("listen failed");
        close(g_listen_fd);
        g_listen_fd = -1;
        return -1;
    }

    printf("[C Socket Server] Initialized on 0.0.0.0:%d\n", port);
    printf("[C Socket Server] Web root: %s\n", web_root);
    printf("[C Socket Server] Results dir: %s\n", results_dir);
    printf("[C Socket Server] Simulation binary: %s\n", sim_bin);

    return 0;
}

int run_server(void) {
    if (g_listen_fd < 0) return -1;

    signal(SIGPIPE, SIG_IGN);

    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(g_listen_fd, (struct sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) {
            if (errno == EINTR) continue;
            perror("accept error");
            break;
        }

        handle_client(client_fd);
    }

    return 0;
}

void stop_server(void) {
    if (g_server_state.is_running && g_server_state.current_pid > 0) {
        printf("[C Socket Server] Terminating active simulation process (PID %d)...\n", g_server_state.current_pid);
        kill(g_server_state.current_pid, SIGTERM);
        int status = 0;
        waitpid(g_server_state.current_pid, &status, 0);
        g_server_state.is_running = false;
    }
    if (g_listen_fd >= 0) {
        close(g_listen_fd);
        g_listen_fd = -1;
    }
}
