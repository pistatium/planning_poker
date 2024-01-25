const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const path = '/ws';

const room = window.location.hash.substr(1) || "";
const joinContainer = document.getElementById('join-container');
const joinButton = document.getElementById('join');
const nameInput = document.getElementById('name');
const cardsContainer = document.getElementById('cards');
const revealButton = document.getElementById('reveal');
const resetButton = document.getElementById('reset');
const estimatesContainer = document.getElementById('estimates');
const participantsContainer = document.getElementById('participants');
const controllerContainer = document.getElementById('controller');
const roomIdDisplay = document.getElementById("room-id-display");
const historyContainer = document.getElementById("history");

const fibonacciNumbers = ['1', '2', '3', '5', '8', '13', '21', '34', '55', '89'];
const specialCards = ['?', '∞'];
let selectedCard = null;
const serverUrl = `${protocol}${window.location.host}${path}?room=${room}`;

const socket = new WebSocket(serverUrl);

roomIdDisplay.innerText = `現在のRoomID: ${room}`;

function setRoomID() {
    // ランダムなRoomIDを生成
    const randomRoomId = Math.random().toString(36).substr(2, 8);
    // RoomIDを表示を更新
    location.hash = randomRoomId;
    roomIdDisplay.innerText = `現在のRoomID: ${randomRoomId}`;
}
if (room === '') {
    setRoomID()
}


socket.addEventListener('open', (event) => {
    console.log('WebSocket connection opened:', event);
    // socket.send(JSON.stringify({type: "joinRoom", room}));
    // 参加ボタンを押下したときのイベント
    joinButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            socket.send(JSON.stringify({type: 'join', user_name: name}));
            joinContainer.classList.add("hidden")
            controllerContainer.classList.remove("hidden")
            saveName(name);
            // setPolling()
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

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);

    if (data.type === 'joined') {
        // joinedイベントを受け取ったときの処理
        renderCards([...fibonacciNumbers, ...specialCards]);
    } else if (data.type === 'error') {
        // errorイベントを受け取ったときの処理
        showError(data.message);
    } else if (data.type === 'estimates') {
        // estimatesイベントを受け取ったときの処理
        renderEstimates(data.estimates);
    }  else if (data.type === 'participants') {
        participantsContainer.innerHTML = "";
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


function renderHistory(estimates) {
    let sum = 0;
    historyRows = []
    for (const [name, point] of estimates) {
        // pointsが数字以外なら無視
        if (isNaN(point) || point === null) {
            continue;
        }
        sum += point;
        historyRows.push(`<span class="font-bold">${name}</span>: ${point}`);
    }
    // 平均と結果の一覧を表示
    const now = new Date();
    const nowJSTStr = now.toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"});
    const historyRowContainer  = document.createElement("div");
    historyRowContainer.classList.add("mb-6");
    historyRowContainer.innerHTML= `
        <div class="text-lg font-bold mb-2">平均: ${sum / historyRows.length}</div>
        <div>${historyRows.join("<br>")}</div>
        ${nowJSTStr}
    `
    historyContainer.prepend(historyRowContainer)
}

function renderParticipant({user_name, is_estimated}){
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
        is_estimated ? "bg-green-200": null
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

let inactivityTimer;
let pollingTimer;

// CloudRun のインスタンスが終了しないように ping を送る
function setPolling() {
    document.addEventListener('click', () => {
        clearTimeout(inactivityTimer);  // 一定時間のタイマーをリセット
        clearInterval(pollingTimer);    // ポーリングを停止

        // 一定時間操作がなければポーリングを停止
        inactivityTimer = setTimeout(() => {
            clearInterval(pollingTimer);
        }, 600 * 1000);
        const ping = function () {
            fetch("/ping")
        };
        pollingTimer = setInterval(ping, 5000);
    });
}
