#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include "socket_server.h"

static void handle_sigint(int sig) {
    (void)sig;
    printf("\n[C Socket Server] Stopping server gracefully...\n");
    stop_server();
    exit(0);
}

int main(int argc, char* argv[]) {
    int port = DEFAULT_PORT;
    char web_root[MAX_PATH_LEN] = "frontend";
    char results_dir[MAX_PATH_LEN] = "results";
    char sim_bin[MAX_PATH_LEN] = "simulation/bufferbloat";

    for (int i = 1; i < argc; ++i) {
        if (strncmp(argv[i], "--port=", 7) == 0) {
            port = atoi(argv[i] + 7);
        } else if (strncmp(argv[i], "--web-root=", 11) == 0) {
            strncpy(web_root, argv[i] + 11, sizeof(web_root) - 1);
            web_root[sizeof(web_root) - 1] = '\0';
        } else if (strncmp(argv[i], "--results-dir=", 14) == 0) {
            strncpy(results_dir, argv[i] + 14, sizeof(results_dir) - 1);
            results_dir[sizeof(results_dir) - 1] = '\0';
        } else if (strncmp(argv[i], "--sim-bin=", 10) == 0) {
            strncpy(sim_bin, argv[i] + 10, sizeof(sim_bin) - 1);
            sim_bin[sizeof(sim_bin) - 1] = '\0';
        } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            printf("Usage: %s [OPTIONS]\n", argv[0]);
            printf("  --port=<port>          Port to listen on (default: 8088)\n");
            printf("  --web-root=<dir>       Path to frontend directory (default: frontend)\n");
            printf("  --results-dir=<dir>    Path to results directory (default: results)\n");
            printf("  --sim-bin=<path>       Path to NS-3 simulation executable (default: simulation/bufferbloat)\n");
            return 0;
        }
    }

    signal(SIGINT, handle_sigint);
    signal(SIGTERM, handle_sigint);

    printf("=================================================================\n");
    printf(" NS-3 BufferBloat Detection & Queue Management Controller (C)   \n");
    printf("=================================================================\n");

    if (init_server(port, web_root, results_dir, sim_bin) != 0) {
        fprintf(stderr, "[Error] Failed to initialize socket server.\n");
        return 1;
    }

    printf("[C Socket Server] Running. Press Ctrl+C to terminate.\n");
    printf("[C Socket Server] Open http://localhost:%d in your web browser.\n", port);

    return run_server();
}
