const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const path = '/ws';


const joinContainer = document.getElementById('join-container');
const joinButton = document.getElementById('join');
const nameInput = document.getElementById('name');
const cardsContainer = document.getElementById('cards');
const revealButton = document.getElementById('reveal');
const resetButton = document.getElementById('reset');
const participantsContainer = document.getElementById('participants');
const controllerContainer = document.getElementById('controller');
const roomIdDisplay = document.getElementById("room-id-display");
const historyContainer = document.getElementById("history");

const fibonacciNumbers = ['1', '2', '3', '5', '8', '13', '21', '34', '55', '89'];
const specialCards = ['?', '∞'];
let selectedCard = null;
let room = window.location.hash.substr(1) || "";

const serverUrl = `${protocol}${window.location.host}${path}?room=${room}`;
const shareUrl = `${window.location.origin}${window.location.pathname}#${room}`;

const socket = new ReconnectingWebSocket(serverUrl);


roomIdDisplay.innerText = `現在のRoomID: ${room}`;

window.addEventListener(
    "hashchange",
    () => {
        location.reload();
    },
    false,
);

let timeoutHandler = null;
const timeout = 5 * 60 * 1000;
document.addEventListener("visibilitychange", () => {

    if (document.hidden) {
        console.log("suspend")
        if (selectedCard) {
            selectedCard.classList.remove("bg-yellow-300");
            selectedCard = null;
        }
        // 一定時間経ったらセッションを切断する
        timeoutHandler = setTimeout(() => {
            console.log("connection closed")
            socket.close();
        }, timeout)
    } else {
        console.log("resume")
        if (timeoutHandler) {
            clearTimeout(timeoutHandler);
        }
        socket.automaticOpen = true;
        if (socket.readyState === WebSocket.CLOSED) {
            socket.open()
            // FIXME: openし終わる前に送るとエラーになるので少し待つ
            setTimeout(() => {
                socket.send(JSON.stringify({type: "join", user_name: nameInput.value.trim()}));
            }, 100)
        }
    }
});

if (room === "") {
    // ランダムなRoomIDを生成
    hash = Math.random().toString(36).substr(2, 8);
    location.hash = hash;
}


socket.addEventListener('open', (event) => {
    console.log('WebSocket connection opened:', event);
    // socket.send(JSON.stringify({type: "joinRoom", room}));
    // 参加ボタンを押下したときのイベント
    joinButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            socket.send(JSON.stringify({type: 'join', user_name: name}));
            renderCards([...fibonacciNumbers, ...specialCards]);
            joinContainer.classList.add("hidden")
            controllerContainer.classList.remove("hidden")
            saveName(name);
        }
    });
    // 開示ボタンを押したときのイベント
    revealButton.addEventListener('click', () => {
        socket.send(JSON.stringify({type: 'reveal'}));
    });

    // リセットボタンを押したときのイベント
    resetButton.addEventListener('click', () => {
        socket.send(JSON.stringify({type: 'reset'}));
    });
});

let historyDateSet = new Set();

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);

    if (data.type === 'joined') {
        // joinedイベントを受け取ったときの処理
    } else if (data.type === 'error') {
        // errorイベントを受け取ったときの処理
        showError(data.message);
    } else if (data.type === 'estimates') {
        // estimatesイベントを受け取ったときの処理
        if (!historyDateSet.has(data.estimated_at)) {
            renderEstimates(data.estimates);
            renderHistory(data.estimates, data.estimated_at);
            historyDateSet.add(data.estimated_at);
        }
    } else if (data.type === 'participants') {
        if (data.state ==="estimated") {
            return;
        }
        participantsContainer.innerHTML = "";
        if (!data.participants) {
            return;
        }

        data.participants.forEach(renderParticipant);
    }
});

function renderCards(cards) {
    cards.forEach((card) => {
        const cardElement = document.createElement('button');
        cardElement.textContent = card;
        cardElement.classList.add(
            'bg-gray-200',
            'text-lg',
            'font-bold',
            'py-2',
            'px-4',
            'rounded'
        );
        cardElement.addEventListener('click', () => {
            if (selectedCard) {
                selectedCard.classList.remove("bg-yellow-300");
            }
            cardElement.classList.add("bg-yellow-300");
            selectedCard = cardElement;
            socket.send(JSON.stringify({type: "estimate", point: card, user_name: nameInput.value.trim()}));
        });
        cardsContainer.appendChild(cardElement);
    });
    const unselectButton = document.createElement("button");
    unselectButton.textContent = "未選択にもどす";
    unselectButton.classList.add(
        "bg-gray-200",
        "hover:bg-gray-300",
        "text-lg",
        "font-bold",
        "py-2",
        "px-4",
        "rounded",
    );
    unselectButton.addEventListener("click", () => {
        if (selectedCard) {
            selectedCard.classList.remove("bg-yellow-300");
            selectedCard = null;
        }
        socket.send(JSON.stringify({type: "estimate", point: "", user_name: nameInput.value.trim()}));
    });
    cardsContainer.appendChild(unselectButton);
}


function renderHistory(estimates, estimatedAt) {
    let sum = 0;
    historyRows = []
    for (const {user_name, point} of estimates) {
        // pointsが数字以外なら無視
        if (isNaN(point) || point === null || point === "") {
            continue;
        }
        sum += parseInt(point);
        historyRows.push(`<span class="font-bold">${user_name}</span>: ${point}`);
    }
    // 平均と結果の一覧を表示
    const historyRowContainer = document.createElement("div");
    historyRowContainer.classList.add("mb-6");
    const date = new Date(estimatedAt)
    const dateJSTStr = date.toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"});
    historyRowContainer.innerHTML = `
        <div class="text-lg font-bold mb-2">平均: ${sum / historyRows.length}</div>
        <div>${historyRows.join("<br>")}</div>
        ${dateJSTStr}
    `
    historyContainer.prepend(historyRowContainer)
}

function renderParticipant({user_name, is_estimated}) {
    const participantElement = document.createElement("div");
    participantElement.classList.add(
        "flex",
        "flex-col",
        "items-center",
        "w-24",
        "h-28",
        "border",
        "border-gray-200",
        "rounded",
        "shadow",
        "p-2",
        "bg-white",
        is_estimated ? "bg-green-200" : null
    );
    const cardElement = document.createElement("div");
    cardElement.classList.add(
        "w-full",
        "h-full",
        "border-2",
        "border-gray-200",
        "rounded",
        "bg-white",
        "flex",
        "items-center",
        "justify-center",
        "text-lg",
        "font-bold"
    );
    const nameElement = document.createElement("div");
    nameElement.textContent = user_name;
    nameElement.classList.add("mt-1", "text-sm");

    participantElement.appendChild(cardElement);
    participantElement.appendChild(nameElement);
    participantsContainer.appendChild(participantElement);
}


function renderEstimates(estimates) {
    const participantElements = Array.from(participantsContainer.children);
    participantElements.forEach((element) => {
        const nameElement = element.querySelector("div:nth-child(2)");
        const name = nameElement.textContent;
        const cardElement = element.querySelector("div:first-child");

        const estimate = estimates.find(({user_name}) => user_name === name);
        if (estimate) {
            cardElement.textContent = estimate.point;
            cardElement.classList.add("border-green-500");
        } else {
            cardElement.textContent = "";
            cardElement.classList.remove("border-green-500");
        }
        cardElement.parentElement.classList.remove("bg-green-200");
    });
}

function showError(message) {
    console.log(message)
    const error = document.createElement('div');
    error.className = 'bg-red-500 text-white px-4 py-2 rounded-lg mb-4';
    error.textContent = message;

    joinContainer.insertBefore(error, joinContainer.firstChild);
    joinContainer.classList.remove("hidden")
    controllerContainer.classList.add("hidden")

    setTimeout(() => {
        joinContainer.removeChild(error);
    }, 3000);
}

// 名前をlocalStorageに保存する
function saveName(name) {
    localStorage.setItem('savedName', name);
}

// 名前をlocalStorageから取得する
function getName() {
    return localStorage.getItem('savedName');
}

// ページをロードする際に、名前を再取得する
document.addEventListener('DOMContentLoaded', () => {
    const savedName = getName();
    if (savedName) {
        nameInput.value = savedName;
    }
});
