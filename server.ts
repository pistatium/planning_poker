import {serve} from 'https://deno.land/std/http/mod.ts';

const port = 8080


const clients = new Map();
let estimates = new Map();
async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url, `http://${req.headers.get("host")}`);

    if (req.method === "GET" && req.headers.get("upgrade") === "websocket") {
        const {socket, response} = Deno.upgradeWebSocket(req);
        socket.onopen = () => {
            console.log("Client connected");
        }
        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === "join") {
                if (!isNameTaken(data.name)) {
                    clients.set(socket, data.name);
                    socket.send(JSON.stringify({type: "joined", name: data.name}));
                    broadcastParticipants();
                } else {
                    socket.send(JSON.stringify({type: "error", message: "名前が重複しています"}));
                }
            } else if (data.type === "estimate") {
                estimates.set(clients.get(socket), data.points);
                // broadcastParticipants();
            } else if (data.type === "reveal") {
                broadcastEstimates();
            } else if (data.type === "reset") {
                resetEstimates();
            }
        }
        socket.onerror = (e) => {
            console.error("WebSocket error:", e);
        }
        socket.onclose = () => {
            clients.delete(socket);
            estimates.delete(clients.get(socket));
        }
        return response;
    } else {
        // Static file serving code
        if (url.pathname === "/") {
            const index = await Deno.readTextFile("public/index.html");
            return new Response(index, {headers: {"content-type": "text/html"}})
        } else if (url.pathname.endsWith(".js")) {
            const js = await Deno.readTextFile("public" + url.pathname);
            return new Response( js, {headers: {"content-type": "application/javascript"}});
        }
        return new Response("404")
    }

}
serve(handler, { port: port });

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