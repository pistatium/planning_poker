import './App.css';

import React, {useState, useEffect, ReactElement} from 'react';
import {WebSocket} from "partysocket";
import Message, {Estimate, MessageError, MessageEstimate, MessageParticipants, Participant} from "./pokerRoom/event.ts";

type Props = {
    roomID: string;
}
const App = ({roomID}: Props): ReactElement => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const path = '/ws';
    const room = window.location.hash.substr(1) || "";
    const serverUrl = `${protocol}${window.location.host}${path}?room=${room}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#${room}`;
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isJoined, setIsJoined] = useState<boolean>(false);
    const [selectedCard, setSelectedCard] = useState<string>("");
    const [userName, setUserName] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);

    useEffect(() => {
        const socket = new WebSocket(serverUrl);

        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection opened:', event);
        });
        socket.addEventListener('message', (event) => {
            console.log('received', event);
            const msg: Message = JSON.parse(event.data);
            switch (msg.type) {
                case "error":
                    receiveError(msg);
                    break;
                case "participants":
                    receiveParticipants(msg);
                    break;
                case "estimates":
                    receiveEstimates(msg);
                    break;
                default:
                    console.error('Unknown message type:', msg);
            }
        });
        setSocket(socket);
        return () => {
            console.log('closing socket');
            socket.close();
        };
    }, []);

    const receiveError = (message: MessageError) => {
        setErrorMessage(message.message);
    };

    const receiveEstimates = (message: MessageEstimate) => {
        setEstimates(message.estimates);
    };

    const receiveParticipants = (message: MessageParticipants) => {
        setParticipants(message.participants || []);
        setIsJoined(true);
    };

    const onClickJoin = () => {
        socket?.send(JSON.stringify({type: 'join', user_name: userName}));
    };

    const onClickReveal = () => {
        socket?.send(JSON.stringify({type: 'reveal', user_name: userName}));
    };
    const onClickReset = () => {
        socket?.send(JSON.stringify({type: 'reset', user_name: userName}));
    };

    const onChangeName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUserName(event.target.value);
    }
    const cards = ['1', '2', '3', '5', '8', '13', '21', '34', '55', '?', '∞', ''];
    const cardElements = cards.map((card, i) => {
        return (
            <div
                key={i}
                className="bg-white hover:bg-gray-10 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow {{selectedCard === card ? 'bg-blue-500 text-white' : ''}}"
                onClick={() => {
                    setSelectedCard(card);
                    socket?.send(JSON.stringify({type: 'estimate', point: card, user_name: userName}));
                }}
            >
                {card}

            </div>
        );
    });
    return (
        <div className="">
            <h1 className="text-3xl font-bold mb-4">プランニングポーカー</h1>
            <div className="flex space-x-4">
                <div id="room-id-display" className="bg-white p-4 m-2 rounded border border-gray-300 flex-grow">Room ID: {roomID}</div>
            </div>

            <div className="error">{errorMessage}</div>
            <div className="bg-white shadow-sm rounded p-6 mt-6 mb-6">
                {isJoined ? (
                    <div>
                        <div id="participants" className="grid grid-cols-6 gap-4"></div>
                        <div id="controller" className="">
                            <div className="mt-6 ">
                                <h2 className="text-2xl font-bold mb-4">見積もりカード</h2>
                                <div id="cards" className="grid grid-cols-4 gap-4">
                                    {cardElements}
                                </div>
                            </div>
                            <div className="mt-6 flex">
                                <button id="reveal" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex-grow">見積もりを開示</button>
                                <button id="reset" className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded ml-4">全員の見積もりをリセット</button>
                            </div>
                            <div className="mt-6">
                                <h2 className="text-2xl font-bold mb-4">履歴</h2>
                                <div id="history" className="">
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form id="join-container" className="flex flex-col items-center" onSubmit={onClickJoin}>
                        <input aria-label="username" id="name" className="border rounded-lg px-3 py-2" placeholder="名前を入力" required value={userName} onChange={onChangeName}/>
                        <button id="join" type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg mt-2">参加</button>
                    </form>
                )
                }

            </div>
            <div id="description" className="bg-white shadow-sm rounded p-6 text-small">
                <h1 className="text-xl font-bold text-center text-gray-600 mb-6">無料で使える、リアルタイムなプランニングポーカー！</h1>
                <p>
                    スクラムイベントのプランニングポーカーをオンラインでやるためのWebアプリです。
                    リアルタイムでのポイント見積もりが無料で利用できます。
                    開発プロジェクトの見積もりなどにぜひお使いください。
                </p>
                <section className="p-2 mb-2">
                    <h2 className="text-lg font-semibold">RoomIDの作成方法</h2>
                    <p>
                        上部に表示されているRoomIDごとに個別のポーカーを管理出来ます。
                        初回はランダムでハッシュが割り当てられますが、URLのハッシュ部分を変更することで好きな名前の部屋を作れます。
                        例：https://poker.pistatium.dev/#YourRoomName のように、# の後に任意の文字列を入れてください。
                        ハッシュ付きのURLを他の人に共有することで、同じ部屋に参加することができます。
                    </p>
                </section>
                <section className="p-2 mb-2">
                    <h2 className="text-lg font-semibold">参加方法</h2>
                    <p>
                        ポーカーに参加する際には、好きな名前を入力してください。
                        入力された名前は一時的にサーバーに保存されますが、一定時間後に自動的に破棄されます。
                    </p>
                </section>
                <section className="p-2 mb-2">
                    <h2 className="text-lg font-semibold">免責事項</h2>
                    <p>
                        本アプリの利用に関しては、ユーザー自身の責任でお願いします。
                        アプリの利用によるいかなる問題や損失についても、当方では責任を負いかねますので、ご了承ください。
                    </p>
                </section>
            </div>

            <a
                href="https://github.com/pistatium/planning_poker_example"
                target="_blank"
                rel="noopener noreferrer"
                className="bottom-4 fixed text-gray-400 right-8"
            >
                View on GitHub
            </a>
        </div>
    );
};

export default App;