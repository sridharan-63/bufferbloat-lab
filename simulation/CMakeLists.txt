cmake_minimum_required(VERSION 3.16)
project(BufferBloatSimulation CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(/usr/include)

add_executable(bufferbloat bufferbloat.cc)

target_link_libraries(bufferbloat PRIVATE
    ns3-core
    ns3-network
    ns3-internet
    ns3-point-to-point
    ns3-applications
    ns3-traffic-control
    ns3-flow-monitor
)
