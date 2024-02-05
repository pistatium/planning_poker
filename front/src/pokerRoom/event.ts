type RoomState = 'open' | 'estimated'

type Participant = {
    user_name: string
    is_estimated: boolean
}

type MessageJoined = {
    type: 'joined'
}
type MessageParticipants = {
    type: 'participants'
    participants?: Participant[]
    state: RoomState
}

type Estimate = {
    user_name: string
    point: string
}

type MessageEstimate = {
    type: 'estimates'
    estimates: Estimate[]
    estimated_at: string
}

type MessageError = {
    type: 'error'
    message: string
}

type Message = MessageParticipants | MessageEstimate | MessageError | MessageJoined
export type { RoomState }
export type { Participant, Estimate }
export type { MessageParticipants, MessageEstimate, MessageError, MessageJoined }
export default Message
