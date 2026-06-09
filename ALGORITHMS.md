# Algorithms

The app now includes two environments:

- Flappy Bird: two legal actions, no-op and flap
- Pong: three legal actions, stay, move up, and move down

Both environments expose a normalized six-feature observation vector. Flappy uses
bird height, vertical speed, pipe distance, gap center, bird-to-gap offset, and
gap height. Pong uses paddle position, ball vertical speed, ball x/y position,
paddle-to-ball offset, and ball horizontal speed.

The rewards are intentionally small and standard for toy teaching tasks:
terminal penalties, survival/alignment shaping, and sparse success bonuses for
passing a pipe or returning a volley. There is no expert replay, imitation
warm-start, hardcoded action override, or rule-based fallback policy.

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

These numbers are deterministic enough to catch regressions, but they are not
intended as benchmark claims. They are teaching baselines for this local app.
CEM evaluates whole candidate episodes, so its measured environment steps can
slightly exceed the requested target step count.
