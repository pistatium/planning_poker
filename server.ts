import {
    WebSocketClient,
    WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";

const wss = new WebSocketServer(8080);

const clients = new Map();
let estimates = new Map();

wss.on("connection", (client: WebSocketClient) => {
    console.log("Client connected");

    client.on("message", (message: string) => {
        const data = JSON.parse(message);

        if (data.type === "join") {
            if (!isNameTaken(data.name)) {
                clients.set(client, data.name);
                client.send(JSON.stringify({type: "joined", name: data.name}));
                broadcastParticipants();
            } else {
                client.send(JSON.stringify({type: "error", message: "名前が重複しています"}));
            }
        } else if (data.type === "estimate") {
            estimates.set(clients.get(client), data.points);
            // broadcastParticipants();
        } else if (data.type === "reveal") {
            broadcastEstimates();
        } else if (data.type === "reset") {
            resetEstimates();
        }
    });

    client.on("close", () => {
        clients.delete(client);
        estimates.delete(clients.get(client));
        console.log("Client disconnected");
    });
});

function broadcastEstimates() {
    for (const client of clients.keys()) {
        client.send(
            JSON.stringify({
                type: "reveal",
                estimates: Array.from(estimates.entries()),
            }),
        );
    }
}

function broadcastParticipants() {
    const participants = Array.from(clients.entries()).map(([client, name]) => ({
        name,
        selected: estimates.has(name),
    }));

    for (const client of clients.keys()) {
        client.send(
            JSON.stringify({
                type: "participants",
                participants,
            }),
        );
    }
}

function resetEstimates() {
    estimates.clear();
    for (const client of clients.keys()) {
        client.send(JSON.stringify({type: "reset"}));
    }
    broadcastParticipants();
}

function isNameTaken(name: string): boolean {
    return Array.from(clients.values()).includes(name);
}