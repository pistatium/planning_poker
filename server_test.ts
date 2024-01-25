import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { WebSocket } from "./deps.ts";
import {serve, handler, startServe} from "./server.ts";

Deno.test("Room participants are managed independently", async () => {
    const port = 8081;
    const server = startServe(port);

    // Connect two clients to different rooms
    const ws1 = new WebSocket(`ws://localhost:${port}`);
    const ws2 = new WebSocket(`ws://localhost:${port}`);
    await Promise.all([ws1.connect(), ws2.connect()]);

    // Join rooms
    ws1.send(JSON.stringify({ type: "joinRoom", room: "room1" }));
    ws2.send(JSON.stringify({ type: "joinRoom", room: "room2" }));

    // Join with names
    ws1.send(JSON.stringify({ type: "join", name: "Alice" }));
    ws2.send(JSON.stringify({ type: "join", name: "Bob" }));

    // Check participants
    let participants1, participants2;
    for await (const message of ws1.receive()) {
        const event = JSON.parse(message.toString());
        if (event.type === "participants") {
            participants1 = event.participants;
            break;
        }
    }
    for await (const message of ws2.receive()) {
        const event = JSON.parse(message.toString());
        if (event.type === "participants") {
            participants2 = event.participants;
            break;
        }
    }

    assertEquals(participants1, [{ name: "Alice", selected: false }]);
    assertEquals(participants2, [{ name: "Bob", selected: false }]);

    ws1.close();
    ws2.close();
    server.close();
});
