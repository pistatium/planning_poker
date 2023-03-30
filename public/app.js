const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const path = '/';
const serverUrl = `${protocol}${window.location.host}${path}`;
const room = window.location.hash.substr(1) || "default";

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
const joinRandomRoomButton = document.getElementById("join-random-room");

const fibonacciNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const specialCards = ['?', '∞'];
let selectedCard = null;

const socket = new WebSocket(serverUrl);

roomIdDisplay.innerText = `現在のRoomID: ${room}`;

joinRandomRoomButton.addEventListener("click", () => {
    // ランダムなRoomIDを生成
    const randomRoomId = Math.random().toString(36).substr(2, 8);

    // 新しい部屋に参加
    socket.send(JSON.stringify({ type: "joinRoom", room: randomRoomId }));

    // RoomIDを表示を更新
    roomIdDisplay.innerText = `現在のRoomID: ${randomRoomId}`;
    location.hash = randomRoomId;
});

socket.addEventListener('open', (event) => {
    console.log('WebSocket connection opened:', event);
    socket.send(JSON.stringify({ type: "joinRoom", room }));
    joinButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            socket.send(JSON.stringify({type: 'join', name}));
            joinContainer.classList.add("hidden")
            controllerContainer.classList.remove("hidden")
            joinRandomRoomButton.classList.add("hidden")
        }
    });

    revealButton.addEventListener('click', () => {
        socket.send(JSON.stringify({type: 'reveal'}));
    });

    resetButton.addEventListener('click', () => {
        socket.send(JSON.stringify({type: 'reset'}));
    });
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);
    if (data.type === 'joined') {
        renderCards([...fibonacciNumbers, ...specialCards]);
    } else if (data.type === 'error') {
        showError(data.message);
    } else if (data.type === 'estimate') {
        updateParticipantStatus(data.name, data.points !== null);
    } else if (data.type === 'reset') {
        resetEstimates();
        resetParticipants();
    } else if (data.type === 'participants') {
        participantsContainer.innerHTML = "";
        data.participants.forEach(renderParticipant);
    } else if (data.type === "reveal") {
        updateParticipants(data.estimates);
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
            socket.send(JSON.stringify({type: "estimate", points: card}));
        });
        cardsContainer.appendChild(cardElement);
    });
    const unselectButton = document.createElement("button");
    unselectButton.textContent = "解除";
    unselectButton.classList.add(
        "bg-gray-200",
        "hover:bg-gray-300",
        "text-lg",
        "font-bold",
        "py-2",
        "px-4",
        "rounded",
        "ml-2"
    );
    unselectButton.addEventListener("click", () => {
        if (selectedCard) {
            selectedCard.classList.remove("bg-yellow-300");
            selectedCard = null;
        }
        socket.send(JSON.stringify({type: "estimate", points: null}));
    });
    cardsContainer.appendChild(unselectButton);
}



function renderParticipant({name, selected}) {
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
        "bg-white"
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
    nameElement.textContent = name;
    nameElement.classList.add("mt-1", "text-sm");

    participantElement.appendChild(cardElement);
    participantElement.appendChild(nameElement);
    participantsContainer.appendChild(participantElement);
}

function resetEstimates() {
    estimatesContainer.innerHTML = "";
    updateParticipants([]);
}

function updateParticipants(estimates) {
    const participantElements = Array.from(participantsContainer.children);
    participantElements.forEach((element) => {
        const nameElement = element.querySelector("div:nth-child(2)");
        const name = nameElement.textContent;
        const cardElement = element.querySelector("div:first-child");

        const estimate = estimates.find(([participantName]) => participantName === name);
        if (estimate) {
            cardElement.textContent = estimate[1];
            cardElement.classList.add("border-green-500");
        } else {
            cardElement.textContent = "";
            cardElement.classList.remove("border-green-500");
        }
    });
}
function updateParticipantStatus(name, estimated) {
    const participantElements = Array.from(participantsContainer.children);
    participantElements.forEach((element) => {
        if (element.textContent === name) {
            if (estimated) {
                element.classList.add("bg-green-200");
            } else {
                element.classList.remove("bg-green-200");
            }
        }
    });
}


function resetParticipants() {
    selectedCard.classList.remove("bg-yellow-300");
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

// イベントリスナーの中で、名前を保存する処理を追加
joinButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        socket.send(JSON.stringify({type: 'join', name}));
        saveName(name); // 名前を保存
        joinContainer.style.display = 'none';
    }
});

// ページをロードする際に、名前を再取得する
document.addEventListener('DOMContentLoaded', () => {
    const savedName = getName();
    if (savedName) {
        nameInput.value = savedName;
    }
});