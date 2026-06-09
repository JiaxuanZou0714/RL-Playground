# RL-Playground

A browser-based reinforcement learning teaching lab for Flappy Bird and Pong.

The current app is a modern static TypeScript/Vite build that can be deployed
directly to GitHub Pages from `docs/`. Training runs inside a Web Worker so the
canvas stays responsive while algorithms update.

Use `Train` to run optimization as fast as the CPU budget allows. Use `Demo` to
play the current learned policy at the environment's normal step rate.

## Environments

- Flappy Bird: two-action survival and pipe-passing task
- Pong: three-action paddle-control task with stay/up/down actions

Both environments use the same normalized six-feature observation shape so the
included algorithms can be compared without changing the learner code.

## Algorithms

- CEM policy search
- Genetic algorithm
- Randomized hill climbing
- Random search
- Double DQN
- Tabular Q-learning
- SARSA
- REINFORCE

CEM is the default because it is a standard policy-search method and reaches a
useful Flappy policy quickly with very low memory. Genetic algorithm, hill
climbing, and random search are black-box policy-search comparisons. Double DQN
is the main neural value-learning baseline and works on both Flappy Bird and
Pong. Q-learning and SARSA show off-policy vs on-policy tabular TD control, and
REINFORCE is the minimal episodic policy-gradient baseline.

See `ALGORITHMS.md` for implementation notes and the current baseline.

## Project Structure

- `src/rl.ts`: shared types, constants, and Flappy/Pong environments
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

CEM evaluates complete candidate episodes, so its benchmark can slightly exceed
the requested step count. The other algorithms use exact step budgets.
