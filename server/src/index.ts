import { createCardGenieServer } from "./room-server";
import { readServerConfig } from "./config";

const config = readServerConfig();
createCardGenieServer(config).run(config.port);
