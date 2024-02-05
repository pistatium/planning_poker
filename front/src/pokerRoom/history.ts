import {Estimate} from "./event.ts";

type History = {
    estimated_at: string
    estimates: Estimate[]
    average: string
}

export default History