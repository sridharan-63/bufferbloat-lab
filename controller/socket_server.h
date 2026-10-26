#ifndef SOCKET_SERVER_H
#define SOCKET_SERVER_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include <sys/types.h>

#define DEFAULT_PORT 8088
#define BUFFER_SIZE 65536
#define MAX_EXP_NAME 256
#define MAX_PATH_LEN 1024

typedef struct {
    int port;
    char web_root[MAX_PATH_LEN];
    char results_dir[MAX_PATH_LEN];
    char sim_bin[MAX_PATH_LEN];
    pid_t current_pid;
    bool is_running;
    int last_exit_code;
    time_t start_time;
    char current_exp[MAX_EXP_NAME];
    char status_message[512];
} ServerState;

extern ServerState g_server_state;

int init_server(int port, const char* web_root, const char* results_dir, const char* sim_bin);
int run_server(void);
void stop_server(void);

#endif // SOCKET_SERVER_H
