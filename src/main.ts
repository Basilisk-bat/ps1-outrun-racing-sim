import './style.css'
import { bootRacingGame } from './game/game.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root')
}

bootRacingGame(app)
