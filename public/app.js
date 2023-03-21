const serverUrl = 'ws://0.0.0.0:8080';
const joinContainer = document.getElementById('join-container');
const joinButton = document.getElementById('join');
const nameInput = document.getElementById('name');
const cardsContainer = document.getElementById('cards');
const revealButton = document.getElementById('reveal');
const resetButton = document.getElementById('reset');
const estimatesContainer = document.getElementById('estimates');
const participantsContainer = document.getElementById('participants');

const fibonacciNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const specialCards = ['?', '∞'];
let selectedCard = null;

const socket = new WebSocket(serverUrl);

socket.addEventListener('open', (event) => {
    console.log('WebSocket connection opened:', event);

    joinButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            socket.send(JSON.stringify({type: 'join', name}));
            joinContainer.style.display = 'none';
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
        // renderParticipant({ name: data.name, selected: false });
        renderCards([...fibonacciNumbers, ...specialCards]);
    } else if (data.type === 'error') {
        showError(data.message);
    } else if (data.type === 'estimate') {
        renderEstimate(data.name, data.points);
    } else if (data.type === 'reset') {
        resetEstimates();
        resetParticipants();
    } else if (data.type === "participant") {
        participantsContainer.innerHTML = "";
        data.participants = []
        data.participants.forEach(({ name, selected }) => {
            renderParticipant({ name, selected });
        });
    } else if (data.type === 'participants') {
        data.participants.forEach(renderParticipant);

    } else if (data.type === "reveal") {
        resetEstimates();
        data.estimates.forEach(([name, points]) => {
            renderEstimate(name, points);
        });
    }
});

function renderCards(cards) {
    cards.forEach((card) => {
        const cardElement = document.createElement('button');
        cardElement.textContent = card;
        cardElement.classList.add(
            'bg-gray-200',
            'hover:bg-gray-300',
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
    unselectButton.textContent = "Unselect";
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
        socket.send(JSON.stringify({ type: "estimate", points: null }));
    });
    cardsContainer.appendChild(unselectButton);
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

function renderEstimate(name, points) {
    const estimateElement = document.createElement('div');
    estimateElement.textContent = `${name}: ${points}`;
    estimateElement.classList.add('p-2', 'bg-white', 'shadow', 'rounded');
    estimatesContainer.appendChild(estimateElement);
}

function renderParticipant({ name, selected }) {
    const participantElement = document.createElement("div");
    participantElement.textContent = name;
    participantElement.classList.add("p-2", "bg-white", "shadow", "rounded");

    if (selected) {
        participantElement.classList.add("border", "border-yellow-500");
    }

    participantsContainer.appendChild(participantElement);
}

function resetEstimates() {
    estimatesContainer.innerHTML = '';
}
function resetParticipants() {
    Array.from(participantsContainer.children).forEach((participantElement) => {
        participantElement.style.backgroundColor = "white";
    });
}
function showError(message) {
    const error = document.createElement('div');
    error.className = 'bg-red-500 text-white px-4 py-2 rounded-lg mb-4';
    error.textContent = message;

    const container = document.getElementById('join-container');
    container.insertBefore(error, container.firstChild);

    setTimeout(() => {
        container.removeChild(error);
    }, 3000);
}