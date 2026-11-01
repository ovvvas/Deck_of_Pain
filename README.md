# DECK OF PAIN

A responsive, installable, offline-capable equipment-free workout PWA.

## Run locally
Service workers require `localhost` or HTTPS. From this directory run:

```bash
python -m http.server 8000
```

Open http://localhost:8000 in your browser. For production, deploy the folder to any static host with HTTPS.

## Included
- Single-player and two-player independent 52-card decks
- Suit-to-exercise assignments and three presets
- Live timers, pause/resume, reps and suit breakdown
- Keyboard controls: W / Space for Player 1, Enter for Player 2
- Local workout history and sound toggle
- Web app manifest and offline service worker

## Rules
2–10 = face value, J/Q/K = 10, Ace = 11. One suit totals 95 reps; all four suits total **380 reps**.

## Notes
- Each player receives a separately shuffled deck.
- A player's timer starts on their first draw.
- In versus mode, the first player to finish is marked complete; a player who abandons is marked ABANDON with a red frame. The summary appears after both players finish or abandon.
- v1.2: card changes only animate the new card (panels are no longer re-rendered), larger card/rep/exercise type, removed the draw hint line and the small rank under the suit.
- Data is stored locally in the browser. Clearing browser site data removes saved history.
- iOS installation: open the HTTPS site in Safari, tap Share, then Add to Home Screen.
- Android installation: use the browser's Install app / Add to Home Screen option.

- v1.3: QA pass — fixed versus-mode page height and footer overflow, safe-area insets, suit-selector and button overflow on small screens, minimum 10px text, 44px touch targets, reduced-motion support; pause/resume logic fixed; summary shows completion and per-suit reps; ABANDON-aware summary text.
- v1.4: fixed-size text slots so nothing shifts when the card changes (exercise name auto-fits 3 lines), larger rep numbers and card ranks, `ABANDONED` label, smaller exercise name in versus mode (>=760px).
