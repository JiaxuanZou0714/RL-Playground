# RL-Playground

A browser-based reinforcement learning teaching lab for Flappy Bird, Pong, and
10x10 Gomoku self-play.

The current app is a modern static TypeScript/Vite build that can be deployed
directly to GitHub Pages from `docs/`. Training runs inside a Web Worker so the
canvas stays responsive while algorithms update.

Use `Train` to run optimization as fast as the CPU budget allows. Use `Demo` to
play the current learned policy at the environment's normal step rate.

## Environments

- Flappy Bird: two-action survival and pipe-passing task
- Pong: three-action paddle-control task with stay/up/down actions
- Gomoku: fixed 10x10 board where one shared policy alternates black and white
  moves in self-play

The control tasks use compact normalized observations. Gomoku uses a 100-cell
current-player board encoding where own stones are `1`, opponent stones are
`-1`, and empty cells are `0`.

## Algorithms

- CEM policy search
- Genetic algorithm
- Randomized hill climbing
- Random search
- AlphaZero-style Gomoku self-play
- Double DQN
- Tabular Q-learning
- SARSA
- REINFORCE

CEM is the default because it is a standard policy-search method and reaches a
useful Flappy policy quickly with very low memory. Genetic algorithm, hill
climbing, and random search are black-box policy-search comparisons. Double DQN
is the main neural value-learning baseline and works on both Flappy Bird and
Pong. Gomoku defaults to a lightweight AlphaZero-style self-play loop that uses
MCTS to improve the move policy, then trains a small policy/value model from
self-play samples. A lightweight champion network is kept for arena-style
candidate promotion. The older algorithms remain available for comparison with
legal-move masking and self-play value targets. Q-learning and SARSA show
off-policy vs on-policy tabular TD control, and REINFORCE is the minimal
episodic policy-gradient baseline.

See `ALGORITHMS.md` for implementation notes and the current baseline.

## Project Structure

- `src/rl.ts`: shared types, constants, and Flappy/Pong/Gomoku environments
- `src/gomoku.ts`: shared Gomoku rules, legal-move helpers, board evaluation, and symmetry transforms
- `src/alphaZero.ts`: Gomoku AlphaZero-style MCTS self-play runtime
- `src/cem.ts`: CEM policy search and linear policy utilities
- `src/standardAlgorithms.ts`: genetic search, hill climbing, random search, Double DQN, Q-learning, SARSA, REINFORCE, and runtime wrappers
- `src/learningCore.ts`: replay buffer, MLP, policy helpers, tabular helpers, and optimizer math
- `src/trainer.worker.ts`: worker entrypoint that keeps training off the UI thread
- `src/main.ts`: app state, worker wiring, controls, and event handling
- `src/uiContent.ts`: app template plus environment and algorithm copy
- `src/rendering.ts`: canvas simulation rendering and SVG chart rendering
- `src/dom.ts`: typed DOM helpers and range-control binding
- `docs/`: GitHub Pages production output

## Local Development

```bash
npm install
npm run dev
```

## Build For GitHub Pages

```bash
npm run build
```

The production site is written to `docs/` with relative asset paths, so GitHub
Pages can publish the repository's `docs` directory.

To serve the built output locally:

```bash
python3 -m http.server 5173 --directory docs
```

## Benchmarks

Run one algorithm:

```bash
npm run bench:flappy -- 30000 cem
npm run bench:flappy -- 30000 double-dqn
npm run bench -- 30000 double-dqn pong
npm run bench -- 30000 alpha-zero gomoku
```

Run all included algorithms:

```bash
npm run bench:all
```

Current baseline on this machine:

| Environment | Algorithm | Eval metric | Teaching target | Notes |
| --- | --- | ---: | --- | --- |
| Flappy Bird | CEM policy search | ~1131 | yes | Fast, low-memory policy-search baseline |
| Flappy Bird | Genetic algorithm | ~977 | yes | Elite selection, crossover, and mutation |
| Flappy Bird | Hill climbing | ~935 | yes | Local mutation search around the current best |
| Flappy Bird | Random search | ~646 | yes | Independent black-box random policy samples |
| Flappy Bird | Double DQN | ~661 | yes | Replay memory plus target network |
| Flappy Bird | Tabular Q-learning | ~425 | no | Included as a discrete-state teaching baseline |
| Flappy Bird | SARSA | ~475 | no | On-policy tabular TD comparison |
| Flappy Bird | REINFORCE | ~318 | no | Episodic softmax policy-gradient baseline |
| Pong | Double DQN | ~5047 | yes | Learns a paddle policy with the same learner code |
| Pong | SARSA | ~1015 | yes | Tabular on-policy learner can solve the easier paddle target |
| Gomoku 10x10 | AlphaZero self-play | ~1440 | yes | Stable versus random, draws the heuristic baseline in this low-compute setting |
| Gomoku 10x10 | CEM policy search | smoke-tested | n/a | Shared-policy self-play with legal move masking |

CEM evaluates complete candidate episodes, so its benchmark can slightly exceed
the requested step count. The other algorithms use exact step budgets.

Gomoku's AlphaZero score is a 0-2000 internal teaching metric, not Elo. The
30k-step gate currently requires a score of at least 1400, no benchmark losses,
at least 95% wins against random play, and at least 50% total wins across the
random and heuristic baselines. It also requires at least one
candidate-to-champion promotion. The final candidate-vs-champion arena must
score at least 0.5 with no more than 25% losses. The champion arena is
deterministic and evaluates both colors over an explicit opening suite: the
empty board and one fixed two-ply opening. On the current verified 30k run it
reached 1440 with no baseline losses, 100% random win rate, and 5
candidate-to-champion promotions. Benchmark output also includes
candidate-side champion arena split scores, value-head MSE/sign accuracy, and
an EMA of normalized MCTS visit entropy. It also reports `searchValue`, the
visit-weighted root value from the latest MCTS search on the -1 to 1 value-head
scale. These are diagnostic signals, not part of the pass/fail score.
