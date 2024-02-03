
type Participant = {
    user_name: string
    is_estimated: boolean
}

type MessageParticipants = {
    type: 'participants'
    participants?: Participant[]
    state: 'open' | 'estimated'
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

type Message = MessageParticipants | MessageEstimate | MessageError

export type { Participant, Estimate }
export type { MessageParticipants, MessageEstimate, MessageError }
export default Message
