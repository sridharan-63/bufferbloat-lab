CXX ?= g++
CC ?= gcc
CXXFLAGS ?= -std=c++20 -O2 -Wall
CFLAGS ?= -O2 -Wall -Wextra -Icontroller

SIM_SRC = simulation/bufferbloat.cc
SIM_BIN = simulation/bufferbloat
SIM_LIBS = -lns3-core -lns3-network -lns3-internet -lns3-point-to-point -lns3-applications -lns3-traffic-control -lns3-flow-monitor

CTRL_SRC = controller/main.c controller/socket_server.c
CTRL_BIN = controller/server

all: $(SIM_BIN) $(CTRL_BIN)

$(SIM_BIN): $(SIM_SRC)
	$(CXX) $(CXXFLAGS) $(SIM_SRC) $(SIM_LIBS) -o $(SIM_BIN)

$(CTRL_BIN): $(CTRL_SRC)
	$(CC) $(CFLAGS) $(CTRL_SRC) -o $(CTRL_BIN)

clean:
	rm -f $(SIM_BIN) $(CTRL_BIN)

frontend-build:
	cd frontend && npm run build

frontend-dev:
	cd frontend && npm run dev

run-server: all
	@if [ -d "frontend/dist" ]; then \
		./$(CTRL_BIN) --port=8088 --web-root=frontend/dist --results-dir=results --sim-bin=$(SIM_BIN); \
	else \
		./$(CTRL_BIN) --port=8088 --web-root=frontend --results-dir=results --sim-bin=$(SIM_BIN); \
	fi

test: all
	@echo "Running verification tests..."
	bash tests/test_simulation.sh

.PHONY: all clean run-server test frontend-build frontend-dev
