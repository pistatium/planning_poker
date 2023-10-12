import {serve} from "https://deno.land/std@0.202.0/http/mod.ts";



type Room = {
    clients: Map<WebSocket, string>;
    estimates: Map<string, number>;
};

const rooms = new Map<string, Room>();
const socketRooms = new Map<WebSocket, string>();

export async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url, `https://${req.headers.get("host")}`);

    if (req.method === "GET" && req.headers.get("upgrade") === "websocket") {
        const {socket, response} = Deno.upgradeWebSocket(req);
        socket.onopen = () => {
            console.log("Client connected");
        }
        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            const currentRoomID = socketRooms.get(socket)
            console.log(data,　currentRoomID)

            if (data.type === "joinRoom") {
                const roomId = data.room || "default";
                socketRooms.set(socket, roomId);
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, {clients: new Map(), estimates: new Map()});
                }
            } else {
                if (!currentRoomID) {
                    console.error("room id error")
                    return;
                }
                const currentRoom = rooms.get(currentRoomID)
                if (!currentRoom) {
                    console.error("No current room found");
                    return;
                }
                if (data.type === "join") {
                    if (!isNameTaken(currentRoom.clients, data.name)) {
                        currentRoom.clients.set(socket, data.name);
                        socket.send(JSON.stringify({type: "joined", name: data.name}));
                        broadcastParticipants(currentRoom.clients, currentRoom.estimates);
                    } else {
                        socket.send(JSON.stringify({type: "error", message: "名前が重複しています"}));
                    }
                } else if (data.type === "estimate") {
                    currentRoom!.estimates.set(currentRoom.clients.get(socket)!, data.points);
                    broadcastEstimate(currentRoom.clients, currentRoom.clients.get(socket)!, data.points);
                } else if (data.type === "reveal") {
                    broadcastEstimates(currentRoom.clients, currentRoom.estimates);
                } else if (data.type === "reset") {
                    resetEstimates(currentRoom.clients, currentRoom.estimates);
                } else if (data.type === "ping") {
                    return;
                }
            }
        }
        socket.onerror = (e) => {
            console.error("WebSocket error:", e);
        }
        socket.onclose = () => {
            if (socketRooms.has(socket)) {
                const roomId = socketRooms.get(socket);
                const currentRoom = rooms.get(roomId || "")
                currentRoom!.clients.delete(socket);
                currentRoom!.estimates.delete(currentRoom!.clients.get(socket)!);
            }
        }
        return response;
    } else {
        if (url.pathname === "/") {
            const index = await Deno.readTextFile("public/index.html");
            return new Response(index, {headers: {"content-type": "text/html"}})
        } else if (url.pathname.endsWith(".js")) {
            const js = await Deno.readTextFile("public" + url.pathname);
            return new Response(js, {headers: {"content-type": "application/javascript"}});
        }
        return new Response("404")
    }
}


function broadcastEstimate(clients: Map<WebSocket, string>, name: string, points: number) {
    for (const client of clients.keys()) {
        client.send(
            JSON.stringify({
                type: "estimate",
                name,
                points,
            }),
        );
    }
}

function broadcastEstimates(clients: Map<WebSocket, string>, estimates: Map<string, number>) {
    for (const client of clients.keys()) {
        client.send(
            JSON.stringify({
                type: "reveal",
                estimates: Array.from(estimates.entries()),
            }),
        );
    }
}

function broadcastParticipants(clients: Map<WebSocket, string>, estimates: Map<string, number>) {
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

function resetEstimates(clients: Map<WebSocket, string>, estimates: Map<string, number>) {
    estimates.clear();
    for (const client of clients.keys()) {
        client.send(JSON.stringify({type: "reset"}));
    }
    broadcastParticipants(clients, estimates);
}

function isNameTaken(clients: Map<WebSocket, string>, name: string): boolean {
    console.log(clients, name)
    return Array.from(clients.values()).includes(name);
}

export function startServe(port: number) {
    return serve(handler, { port: port, hostname: "0.0.0.0"});
}

if (import.meta.main) {
    const port = Deno.env.get("PORT") || "8080";
    startServe(parseInt(port));
}
