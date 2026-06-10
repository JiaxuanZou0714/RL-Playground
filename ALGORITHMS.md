# Algorithms

The app now includes three environments:

- Flappy Bird: two legal actions, no-op and flap
- Pong: three legal actions, stay, move up, and move down
- Gomoku: a fixed 10x10 board where one shared policy alternates black and white
  moves in self-play

The control environments expose a normalized six-feature observation vector.
Flappy uses bird height, vertical speed, pipe distance, gap center,
bird-to-gap offset, and gap height. Pong uses paddle position, ball vertical
speed, ball x/y position, paddle-to-ball offset, and ball horizontal speed.
Gomoku exposes a 100-cell current-player board encoding where own stones are
`1`, opponent stones are `-1`, and empty cells are `0`.

The control rewards are intentionally small and standard for toy teaching tasks:
terminal penalties, survival/alignment shaping, and sparse success bonuses for
passing a pipe or returning a volley. Gomoku self-play stores terminal game
outcomes as value targets and MCTS visit counts as policy targets. There is no
expert replay, imitation warm-start, or fixed opponent used for training.

## CEM Policy Search

Cross-Entropy Method samples a population of linear policies, evaluates each
candidate, keeps the best elites, and updates the sampling distribution. It is
the default because it is a useful teaching baseline for policy search: simple,
fast, low-memory, and easy to visualize.

## Genetic Algorithm

The genetic algorithm keeps an explicit population of linear policies. At the
end of each generation it copies elite policies, creates children with blended
crossover from two elite parents, and applies Gaussian mutation. It is included
to show the classic selection/crossover/mutation view of evolutionary search.

## Randomized Hill Climbing

Hill climbing maintains only the current best linear policy. Each candidate is a
Gaussian mutation around that best policy and is accepted only if its fitness
improves. It is very fast and memory-light, but can get stuck in local optima.

## Random Search

Random search independently samples linear policies and keeps the historical
best. It is intentionally naive and serves as a lower-bound teaching baseline
for black-box policy optimization.

## AlphaZero-style Gomoku Self-play

The Gomoku default is a lightweight AlphaZero-style loop:

- one shared policy/value network plays both black and white from the current
  player's perspective
- PUCT/MCTS improves the move distribution before each self-play move
- root Dirichlet noise and opening temperature keep self-play exploratory
- visit-count distributions become policy targets
- terminal win/loss/draw outcomes become value targets
- eight board symmetries augment each self-play record
- replay samples train the policy/value network with a mini-batch Adam update
- a champion network is kept and candidates are promoted after arena games

The browser version uses a 96-unit shared-hidden-layer network and a slowly
annealed normalized shape prior so that 20-search simulations per move remain
usable in real time. That prior is a low-compute search aid, not a fixed
training opponent. Evaluation is separate and plays both colors against random
and heuristic baselines. A small deterministic arena also plays the current
candidate against the champion as both colors over an explicit opening suite:
the empty board and one fixed two-ply opening. The champion is replaced when
the candidate scores at least 55% with no more than 25% losses. This is a
compact teaching version of AlphaZero's model-gating idea, not a distributed
tournament.

The Gomoku score is a 0-2000 teaching metric:

```text
winRate * 1400 + drawRate * 500 + randomWinRate * 200
+ heuristicWinRate * 350 + winRate * speedBonus * 50
```

A terminal self-play win still records `2000` as the training best. The
evaluation curve is stricter: the current 30k gate requires score >= 1400, zero
baseline losses, random win rate >= 95%, total benchmark win rate >= 50%, a
final candidate-vs-champion arena score of at least 0.5 with no more than 25%
arena losses, and at least one candidate-to-champion promotion.
The benchmark output also reports random and heuristic baseline win/draw/loss
rates separately, black/white-side baseline scores, candidate-side champion
arena scores, value-head MSE/sign accuracy, plus an EMA of normalized MCTS
visit entropy and the latest visit-weighted root search value. Regressions can
be traced to a specific opponent class, side bias, arena fragility, value
calibration, or an over-diffuse/over-collapsed MCTS policy.

## Double DQN

Double DQN uses:

- replay memory
- an online Q-network
- a lagged target Q-network
- Double DQN target selection
- epsilon-greedy exploration
- Huber loss
- Adam updates

The implementation is intentionally small but follows the standard algorithmic
shape. It does not use demonstrations or environment-specific action rules.

## Tabular Q-learning

Tabular Q-learning discretizes the observation vector and applies the Bellman
optimality update. It is included to show the limits of coarse state
discretization on a continuous-control-style game.

## SARSA

SARSA uses the same discretized table as Q-learning, but its TD target uses the
next action selected by the current epsilon-greedy behavior policy. It is the
on-policy contrast to Q-learning's off-policy max target.

## REINFORCE

REINFORCE collects complete episodes, computes discounted returns, and applies
the score-function policy-gradient update to a linear softmax policy. It is
included as a minimal policy-gradient baseline.

## Current 30k-step Baseline

| Environment | Algorithm | Eval metric | Teaching target |
| --- | --- | ---: | --- |
| Flappy Bird | CEM policy search | ~1131 | yes |
| Flappy Bird | Genetic algorithm | ~977 | yes |
| Flappy Bird | Hill climbing | ~935 | yes |
| Flappy Bird | Random search | ~646 | yes |
| Flappy Bird | Double DQN | ~661 | yes |
| Flappy Bird | Tabular Q-learning | ~425 | no |
| Flappy Bird | SARSA | ~475 | no |
| Flappy Bird | REINFORCE | ~318 | no |
| Pong | Double DQN | ~5047 | yes |
| Pong | SARSA | ~1015 | yes |
| Gomoku 10x10 | AlphaZero self-play | ~1440 | yes |

These numbers are deterministic enough to catch regressions, but they are not
intended as benchmark claims. They are teaching baselines for this local app.
CEM evaluates whole candidate episodes, so its measured environment steps can
slightly exceed the requested target step count.
