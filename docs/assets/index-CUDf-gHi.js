(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(){return{environment:`flappy`,algorithm:`cem`,populationSize:48,eliteSize:8,initialStd:1.2,minStd:.05,stdDecay:.9,maxEpisodeSteps:1200,evalRuns:10,candidatesPerBurst:4,trainBudgetMs:12,replayCapacity:2e4,batchSize:16,warmupSteps:500,gamma:.99,learningRate:.001,epsilonStart:1,epsilonMin:.03,epsilonDecaySteps:12e3,targetUpdateSteps:600,trainEverySteps:2}}var t={flappy:{title:`Flappy Bird 示教`,description:`在一个紧凑、确定性的环境中比较标准强化学习算法的训练行为。`,canvasLabel:`Flappy Bird 仿真画面`,chartLabel:`距离`},pong:{title:`Pong 示教`,description:`训练智能体控制球拍跟踪小球、完成回击，并尽量延长每个回合。`,canvasLabel:`Pong 仿真画面`,chartLabel:`回合长度`}},n=new Worker(new URL(``+new URL(`trainer.worker-CioYs_oo.js`,import.meta.url).href,``+import.meta.url),{type:`module`}),r=document.querySelector(`#app`);if(!r)throw Error(`Missing #app container`);r.innerHTML=`
  <header class="topbar">
    <div class="brand">RL-Playground</div>
    <nav class="nav" aria-label="环境">
      <button class="nav-item active" type="button" data-environment="flappy">Flappy Bird</button>
      <button class="nav-item" type="button" data-environment="pong">Pong</button>
    </nav>
  </header>
  <main class="shell">
    <section class="workspace">
      <div class="stage-toolbar">
        <div>
          <h1 id="environment-title">Flappy Bird 示教</h1>
          <p id="environment-description">在一个紧凑、确定性的环境中比较标准强化学习算法的训练行为。</p>
        </div>
        <div class="actions">
          <button id="toggle-run" class="primary" type="button">训练</button>
          <button id="toggle-demo" type="button">演示</button>
          <button id="reset-run" type="button">重置</button>
        </div>
      </div>
      <div class="game-layout">
        <canvas id="game-canvas" width="800" height="600" aria-label="Flappy Bird 仿真画面"></canvas>
        <aside class="metrics" aria-label="训练指标">
          <div class="metric"><span>环境步数</span><strong id="steps">0</strong></div>
          <div class="metric"><span>回合数</span><strong id="episodes">0</strong></div>
          <div class="metric"><span>参数更新</span><strong id="updates">0</strong></div>
          <div class="metric"><span id="work-label">候选个体</span><strong id="work-item">0</strong></div>
          <div class="metric"><span>训练最优</span><strong id="best-distance">0</strong></div>
          <div class="metric"><span>评估最优</span><strong id="best-eval">0</strong></div>
          <div class="metric"><span id="objective-label">目标值</span><strong id="objective">0</strong></div>
          <div class="metric"><span>步/秒</span><strong id="sps">0</strong></div>
        </aside>
      </div>
    </section>
    <section class="sidepanel">
      <div class="panel-section">
        <h2>算法</h2>
        <select id="algorithm-select" aria-label="算法">
          <option value="cem" selected>CEM 策略搜索</option>
          <option value="genetic">遗传算法</option>
          <option value="hill-climb">爬山搜索</option>
          <option value="random-search">随机搜索</option>
          <option value="double-dqn">Double DQN</option>
          <option value="q-learning">表格 Q-learning</option>
          <option value="sarsa">SARSA</option>
          <option value="reinforce">REINFORCE</option>
        </select>
        <p class="panel-note" id="algorithm-note">CEM 通过采样一批线性策略、保留精英样本并更新采样分布来直接优化策略。</p>
      </div>
      <div class="panel-section">
        <h2 id="control-title">CEM 参数</h2>
        <label class="population-control">
          种群规模
          <input id="population-size" type="range" min="16" max="128" step="8" value="48" />
          <output id="population-size-output">48</output>
        </label>
        <label class="elite-control">
          精英数量
          <input id="elite-size" type="range" min="2" max="24" step="1" value="8" />
          <output id="elite-size-output">8</output>
        </label>
        <label>
          单回合上限
          <input id="max-episode-steps" type="range" min="400" max="3000" step="100" value="1200" />
          <output id="max-episode-steps-output">1200</output>
        </label>
        <label class="gradient-control">
          学习率
          <input id="learning-rate" type="range" min="0.0001" max="0.002" step="0.0001" value="0.001" />
          <output id="learning-rate-output">0.001</output>
        </label>
        <label class="value-control">
          探索衰减步数
          <input id="epsilon-decay" type="range" min="5000" max="80000" step="1000" value="12000" />
          <output id="epsilon-decay-output">12000</output>
        </label>
        <label class="dqn-control">
          批大小
          <input id="batch-size" type="range" min="16" max="128" step="16" value="16" />
          <output id="batch-size-output">16</output>
        </label>
        <label>
          CPU 预算
          <input id="train-budget" type="range" min="4" max="24" step="1" value="12" />
          <output id="train-budget-output">12 ms</output>
        </label>
      </div>
      <div class="panel-section chart-section">
        <h2>评估曲线</h2>
        <canvas id="chart-canvas" width="620" height="260" aria-label="训练过程中的评估距离"></canvas>
      </div>
    </section>
  </main>
  <section class="teaching-section" aria-labelledby="algorithm-teaching-title">
    <div class="teaching-header">
      <h2 id="algorithm-teaching-title">算法说明</h2>
      <p>这个示教页把训练、评估和演示放在同一屏：先用“训练”让模型快速更新，再用“演示”观察当前策略在正常速度下的行为。统一记号：观察为 s，动作为 a，奖励为 r，折扣因子为 γ，参数为 θ；连续观察会被部分算法离散成表格状态 ŝ。</p>
    </div>
    <div class="algorithm-grid">
      <article class="algorithm-card">
        <h3>CEM 策略搜索</h3>
        <p>CEM 不学习价值函数，而是直接搜索线性策略参数。页面里的策略对每个动作打分，然后选择分数最高的动作。</p>
        <div class="formula">
          <math display="block" aria-label="动作等于让线性策略分数最大的动作">
            <mi>a</mi>
            <mo>=</mo>
            <munder>
              <mi>argmax</mi>
              <mi>a</mi>
            </munder>
            <mo>(</mo>
            <msub><mi>w</mi><mi>a</mi></msub>
            <mo>·</mo>
            <mi>s</mi>
            <mo>+</mo>
            <msub><mi>b</mi><mi>a</mi></msub>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="第 i 个策略参数从高斯分布中采样">
            <msub><mi>θ</mi><mi>i</mi></msub>
            <mo>∼</mo>
            <mi>𝒩</mi>
            <mo>(</mo>
            <mi>μ</mi>
            <mo>,</mo>
            <mi>diag</mi>
            <mo>(</mo>
            <msup><mi>σ</mi><mn>2</mn></msup>
            <mo>)</mo>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="CEM 用精英集合更新均值和标准差">
            <mi>μ</mi>
            <mo>←</mo>
            <mi>mean</mi>
            <mo>(</mo><mi>E</mi><mo>)</mo>
            <mo>,</mo>
            <mi>σ</mi>
            <mo>←</mo>
            <mi>max</mi>
            <mo>(</mo>
            <msub><mi>σ</mi><mi>min</mi></msub>
            <mo>,</mo>
            <mi>decay</mi>
            <mo>·</mo>
            <mi>std</mi>
            <mo>(</mo><mi>E</mi><mo>)</mo>
            <mo>)</mo>
          </math>
        </div>
        <p>每一代采样一个种群，跑完整回合得到适应度，保留精英集合 E，再把采样均值和方差移向精英。当前实现的适应度是距离加上得分奖励，适合 Flappy 和 Pong 这种短回合任务。</p>
        <p class="watch-point">观察重点：候选个体表示当前代已经评估了多少策略；目标值是精英平均距离。CEM 内存占用很低，但样本效率取决于种群规模和精英数量。</p>
      </article>
      <article class="algorithm-card">
        <h3>遗传算法</h3>
        <p>遗传算法同样直接搜索线性策略，但它保留完整种群，通过精英保留、交叉和突变产生下一代，而不是拟合一个高斯分布。</p>
        <div class="formula">
          <math display="block" aria-label="遗传算法保留适应度最高的精英集合">
            <mi>E</mi>
            <mo>=</mo>
            <msub><mi>top</mi><mi>k</mi></msub>
            <mo>{</mo>
            <mi>F</mi>
            <mo>(</mo><msub><mi>θ</mi><mi>i</mi></msub><mo>)</mo>
            <mo>}</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="子代由两个父代交叉得到">
            <msub><mi>θ</mi><mi>child</mi></msub>
            <mo>=</mo>
            <mi>β</mi>
            <msub><mi>θ</mi><mi>p1</mi></msub>
            <mo>+</mo>
            <mo>(</mo><mn>1</mn><mo>-</mo><mi>β</mi><mo>)</mo>
            <msub><mi>θ</mi><mi>p2</mi></msub>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="子代参数带有高斯突变">
            <msub><mi>θ</mi><mi>child</mi></msub>
            <mo>←</mo>
            <msub><mi>θ</mi><mi>child</mi></msub>
            <mo>+</mo>
            <mi>σ</mi>
            <mi>ε</mi>
            <mo>,</mo>
            <mi>ε</mi>
            <mo>∼</mo>
            <mi>𝒩</mi>
            <mo>(</mo><mn>0</mn><mo>,</mo><mi>I</mi><mo>)</mo>
          </math>
        </div>
        <p>当前实现每代先复制精英，再从精英里抽父代做连续权重交叉，并以一定概率突变。它比 CEM 更贴近“选择、交叉、变异”的经典进化算法。</p>
        <p class="watch-point">观察重点：目标值是精英平均距离；种群规模和精英数量决定探索宽度。它适合示教黑盒优化，但样本效率通常不如 CEM 稳定。</p>
      </article>
      <article class="algorithm-card">
        <h3>爬山搜索</h3>
        <p>爬山搜索只维护当前最优策略，每次在它附近采样一个突变体；如果突变体表现更好，就接受它作为新的中心。</p>
        <div class="formula">
          <math display="block" aria-label="爬山搜索围绕当前最优参数采样突变体">
            <msup><mi>θ</mi><mo>′</mo></msup>
            <mo>=</mo>
            <msub><mi>θ</mi><mi>best</mi></msub>
            <mo>+</mo>
            <mi>σ</mi>
            <mi>ε</mi>
            <mo>,</mo>
            <mi>ε</mi>
            <mo>∼</mo>
            <mi>𝒩</mi>
            <mo>(</mo><mn>0</mn><mo>,</mo><mi>I</mi><mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="只有更优突变体会被接受">
            <msub><mi>θ</mi><mi>best</mi></msub>
            <mo>←</mo>
            <msup><mi>θ</mi><mo>′</mo></msup>
            <mtext> if </mtext>
            <mi>F</mi>
            <mo>(</mo><msup><mi>θ</mi><mo>′</mo></msup><mo>)</mo>
            <mo>&gt;</mo>
            <mi>F</mi>
            <mo>(</mo><msub><mi>θ</mi><mi>best</mi></msub><mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="突变尺度逐代衰减">
            <mi>σ</mi>
            <mo>←</mo>
            <mi>max</mi>
            <mo>(</mo>
            <msub><mi>σ</mi><mi>min</mi></msub>
            <mo>,</mo>
            <mi>decay</mi>
            <mo>·</mo>
            <mi>σ</mi>
            <mo>)</mo>
          </math>
        </div>
        <p>它是最容易理解的局部搜索基线：没有回放池、没有梯度，也没有种群交叉。缺点是容易陷入局部最优，早期突变尺度很关键。</p>
        <p class="watch-point">观察重点：参数更新代表接受了多少次更优突变；目标值显示当前最优距离。它跑得很快，但探索能力弱于 CEM 和遗传算法。</p>
      </article>
      <article class="algorithm-card">
        <h3>随机搜索</h3>
        <p>随机搜索完全不利用上一轮经验，每次独立采样一个线性策略并保留历史最好策略。它是所有策略搜索算法的朴素下界。</p>
        <div class="formula">
          <math display="block" aria-label="随机搜索独立采样策略参数">
            <msub><mi>θ</mi><mi>i</mi></msub>
            <mo>∼</mo>
            <mi>𝒩</mi>
            <mo>(</mo><mn>0</mn><mo>,</mo><msup><mi>σ</mi><mn>2</mn></msup><mi>I</mi><mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="随机搜索保留历史最高适应度策略">
            <msub><mi>θ</mi><mi>best</mi></msub>
            <mo>=</mo>
            <munder>
              <mi>argmax</mi>
              <mi>i</mi>
            </munder>
            <mi>F</mi>
            <mo>(</mo><msub><mi>θ</mi><mi>i</mi></msub><mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="适应度使用回合距离和得分">
            <mi>F</mi>
            <mo>(</mo><mi>θ</mi><mo>)</mo>
            <mo>=</mo>
            <mi>distance</mi>
            <mo>+</mo>
            <mn>1000</mn>
            <mo>·</mo>
            <mi>score</mi>
          </math>
        </div>
        <p>这个算法故意简单，用来说明“只随机试”也能偶尔找到可用策略，但没有分布更新、交叉或价值学习，所以长期效率有限。</p>
        <p class="watch-point">观察重点：如果随机搜索表现接近复杂算法，说明任务或奖励太容易；如果差距很大，就能直观看到学习机制的价值。</p>
      </article>
      <article class="algorithm-card">
        <h3>Double DQN</h3>
        <p>Double DQN 学习动作价值函数 Qθ(s,a)。在线网络负责选下一步动作，目标网络负责给这个动作估值，从而缓解普通 DQN 对最大值的过估计。</p>
        <div class="formula">
          <math display="block" aria-label="在线网络选择下一状态中的最大动作">
            <msup><mi>a</mi><mo>*</mo></msup>
            <mo>=</mo>
            <munder>
              <mi>argmax</mi>
              <mi>a</mi>
            </munder>
            <msub><mi>Q</mi><mi>θ</mi></msub>
            <mo>(</mo>
            <msup><mi>s</mi><mo>′</mo></msup>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="Double DQN 的目标值">
            <mi>y</mi>
            <mo>=</mo>
            <mi>r</mi>
            <mo>+</mo>
            <mi>γ</mi>
            <mo>(</mo><mn>1</mn><mo>-</mo><mi>done</mi><mo>)</mo>
            <msub>
              <mi>Q</mi>
              <msup><mi>θ</mi><mo>-</mo></msup>
            </msub>
            <mo>(</mo>
            <msup><mi>s</mi><mo>′</mo></msup>
            <mo>,</mo>
            <msup><mi>a</mi><mo>*</mo></msup>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="Double DQN 使用 Huber 损失">
            <mi>L</mi>
            <mo>=</mo>
            <mi>Huber</mi>
            <mo>(</mo>
            <msub><mi>Q</mi><mi>θ</mi></msub>
            <mo>(</mo><mi>s</mi><mo>,</mo><mi>a</mi><mo>)</mo>
            <mo>-</mo>
            <mi>y</mi>
            <mo>)</mo>
          </math>
        </div>
        <p>当前实现使用 6 维观察输入、两层 MLP、经验回放池和目标网络。训练时先用 ε-greedy 收集样本，回放池达到预热数量后按批次抽样，用 Adam 优化 Huber 损失。</p>
        <p class="watch-point">观察重点：回放池越大，批量训练越稳定；目标值显示 loss；评估曲线比训练最优更能反映当前策略是否真的会玩。</p>
      </article>
      <article class="algorithm-card">
        <h3>表格 Q-learning</h3>
        <p>Q-learning 是最经典的离线价值迭代思想：把当前状态动作值向 Bellman 最优目标移动。本页面先把连续观察离散成表格索引 s#，再更新对应动作。</p>
        <div class="formula">
          <math display="block" aria-label="Q-learning 的 TD 误差">
            <mi>δ</mi>
            <mo>=</mo>
            <mi>r</mi>
            <mo>+</mo>
            <mi>γ</mi>
            <munder>
              <mi>max</mi>
              <msup><mi>a</mi><mo>′</mo></msup>
            </munder>
            <mi>Q</mi>
            <mo>(</mo>
            <msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup>
            <mo>,</mo>
            <msup><mi>a</mi><mo>′</mo></msup>
            <mo>)</mo>
            <mo>-</mo>
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="Q-learning 表格更新">
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
            <mo>←</mo>
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
            <mo>+</mo>
            <mi>α</mi>
            <mi>δ</mi>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="探索率指数衰减">
            <mi>ε</mi>
            <mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>=</mo>
            <msub><mi>ε</mi><mi>min</mi></msub>
            <mo>+</mo>
            <mo>(</mo>
            <msub><mi>ε</mi><mi>start</mi></msub>
            <mo>-</mo>
            <msub><mi>ε</mi><mi>min</mi></msub>
            <mo>)</mo>
            <msup>
              <mi>e</mi>
              <mrow>
                <mo>-</mo>
                <mfrac><mi>t</mi><mi>decay</mi></mfrac>
              </mrow>
            </msup>
          </math>
        </div>
        <p>它不需要神经网络，更新几乎没有额外内存成本。代价是状态分箱会丢掉连续位置、速度和误差的细节，所以在需要精细控制的地方容易卡住。</p>
        <p class="watch-point">观察重点：探索率会随训练步数下降；目标值显示 TD 误差。若 TD 误差很小但评估仍差，通常说明状态离散化不足。</p>
      </article>
      <article class="algorithm-card">
        <h3>SARSA</h3>
        <p>SARSA 也是表格 TD 控制，但它是 on-policy：更新目标使用当前探索策略实际选出的下一动作，而不是直接取下一状态的最大 Q 值。</p>
        <div class="formula">
          <math display="block" aria-label="SARSA 按当前策略选择下一动作">
            <msup><mi>a</mi><mo>′</mo></msup>
            <mo>∼</mo>
            <mi>π</mi>
            <mo>(</mo>
            <mo>·</mo>
            <mo>|</mo>
            <msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="SARSA 的 TD 误差">
            <mi>δ</mi>
            <mo>=</mo>
            <mi>r</mi>
            <mo>+</mo>
            <mi>γ</mi>
            <mi>Q</mi>
            <mo>(</mo>
            <msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup>
            <mo>,</mo>
            <msup><mi>a</mi><mo>′</mo></msup>
            <mo>)</mo>
            <mo>-</mo>
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="SARSA 表格更新">
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
            <mo>←</mo>
            <mi>Q</mi>
            <mo>(</mo>
            <mover><mi>s</mi><mo>^</mo></mover>
            <mo>,</mo>
            <mi>a</mi>
            <mo>)</mo>
            <mo>+</mo>
            <mi>α</mi>
            <mi>δ</mi>
          </math>
        </div>
        <p>它和 Q-learning 代码结构几乎一样，但目标更保守，因为下一动作仍带有探索噪声。教学上可以用它观察 on-policy 与 off-policy 的差异。</p>
        <p class="watch-point">观察重点：探索率和 TD 误差含义与 Q-learning 相同；若 SARSA 更稳但上限更低，通常是探索策略影响了学习目标。</p>
      </article>
      <article class="algorithm-card">
        <h3>REINFORCE</h3>
        <p>REINFORCE 直接优化随机策略。它先按策略采样完整轨迹，再用每一步之后的折扣回报给动作概率做加权。</p>
        <div class="formula">
          <math display="block" aria-label="REINFORCE 使用 softmax 随机策略">
            <msub><mi>π</mi><mi>θ</mi></msub>
            <mo>(</mo><mi>a</mi><mo>|</mo><mi>s</mi><mo>)</mo>
            <mo>=</mo>
            <mi>softmax</mi>
            <mo>(</mo>
            <msub><mi>w</mi><mi>a</mi></msub>
            <mo>·</mo>
            <mi>s</mi>
            <mo>+</mo>
            <msub><mi>b</mi><mi>a</mi></msub>
            <mo>)</mo>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="从时间 t 开始的折扣回报">
            <msub><mi>G</mi><mi>t</mi></msub>
            <mo>=</mo>
            <munderover>
              <mo>Σ</mo>
              <mrow><mi>k</mi><mo>=</mo><mi>t</mi></mrow>
              <mrow><mi>T</mi><mo>-</mo><mn>1</mn></mrow>
            </munderover>
            <msup>
              <mi>γ</mi>
              <mrow><mi>k</mi><mo>-</mo><mi>t</mi></mrow>
            </msup>
            <msub><mi>r</mi><mi>k</mi></msub>
          </math>
        </div>
        <div class="formula">
          <math display="block" aria-label="REINFORCE 的负对数似然损失">
            <mi>L</mi>
            <mo>(</mo><mi>θ</mi><mo>)</mo>
            <mo>=</mo>
            <mo>-</mo>
            <munder><mo>Σ</mo><mi>t</mi></munder>
            <msub><mi>G</mi><mi>t</mi></msub>
            <mi>log</mi>
            <msub><mi>π</mi><mi>θ</mi></msub>
            <mo>(</mo>
            <msub><mi>a</mi><mi>t</mi></msub>
            <mo>|</mo>
            <msub><mi>s</mi><mi>t</mi></msub>
            <mo>)</mo>
          </math>
        </div>
        <p>当前实现每个回合结束后统一反传一次，用 Adam 更新线性 softmax 策略。它概念清晰，但没有 baseline，回报方差比 DQN 高，训练曲线会更抖。</p>
        <p class="watch-point">观察重点：回合长度表示当前正在收集的轨迹长度；目标值是本回合起点回报。用它理解策略梯度，比指望它最快通关更合适。</p>
      </article>
    </div>
  </section>
`;var i=D(`game-canvas`),a=D(`chart-canvas`),o=k(i),s=k(a),c=O(`toggle-run`),l=O(`toggle-demo`),u=O(`reset-run`),d=Array.from(document.querySelectorAll(`[data-environment]`)),f=e(),p={running:!1,demoRunning:!1,stats:{environment:f.environment,algorithm:f.algorithm,steps:0,episodes:0,updates:0,workItem:0,bestDistance:0,bestEvalDistance:0,objective:0,exploration:f.initialStd,replaySize:0,sps:0},render:null,evalHistory:[]};E(`population-size`,`population-size-output`,``,e=>{h({populationSize:e})}),E(`elite-size`,`elite-size-output`,``,e=>{h({eliteSize:e})}),E(`max-episode-steps`,`max-episode-steps-output`,``,e=>{h({maxEpisodeSteps:e})}),E(`learning-rate`,`learning-rate-output`,``,e=>{h({learningRate:e})}),E(`epsilon-decay`,`epsilon-decay-output`,``,e=>{h({epsilonDecaySteps:e})}),E(`batch-size`,`batch-size-output`,``,e=>{h({batchSize:e})}),E(`train-budget`,`train-budget-output`,` ms`,e=>{h({trainBudgetMs:e})});for(let e of d)e.addEventListener(`click`,()=>{let t=e.dataset.environment;!t||t===f.environment||h({environment:t})});var m=document.getElementById(`algorithm-select`);if(!(m instanceof HTMLSelectElement))throw Error(`Missing algorithm select`);m.addEventListener(`change`,()=>{h({algorithm:m.value})}),c.addEventListener(`click`,()=>{n.postMessage({type:p.running?`pause`:`start`})}),l.addEventListener(`click`,()=>{n.postMessage({type:p.demoRunning?`pause-demo`:`start-demo`})}),u.addEventListener(`click`,()=>{n.postMessage({type:`reset`,config:f})}),n.onmessage=e=>{let t=e.data;t.type===`state`&&(p.running=t.running,p.demoRunning=t.demoRunning,p.stats=t.stats,p.render=t.render,p.evalHistory=t.evalHistory,g(),w(s,a,p.evalHistory,p.stats.environment))},_(f.environment),n.postMessage({type:`reset`,config:f}),requestAnimationFrame(b);function h(e){Object.assign(f,e),n.postMessage({type:`config`,config:e})}function g(){c.textContent=p.running?`暂停训练`:`训练`,l.textContent=p.demoRunning?`停止演示`:`演示`,l.classList.toggle(`secondary-active`,p.demoRunning),A(`steps`,j(p.stats.steps)),A(`episodes`,j(p.stats.episodes)),A(`updates`,j(p.stats.updates)),A(`work-item`,j(p.stats.workItem)),A(`best-distance`,p.stats.bestDistance.toFixed(0)),A(`best-eval`,p.stats.bestEvalDistance.toFixed(0)),A(`objective`,p.stats.objective.toFixed(3)),A(`sps`,p.stats.sps.toFixed(0)),v(p.stats),_(p.stats.environment)}function _(e){let n=t[e];A(`environment-title`,n.title),A(`environment-description`,n.description),i.setAttribute(`aria-label`,n.canvasLabel),a.setAttribute(`aria-label`,`训练过程中的评估${n.chartLabel}`);for(let t of d){let n=t.dataset.environment===e;t.classList.toggle(`active`,n),t.setAttribute(`aria-pressed`,String(n))}}function v(e){A(`algorithm-note`,{cem:`CEM 通过采样一批线性策略、保留精英样本并更新采样分布来直接优化策略。`,genetic:`遗传算法保留精英策略，通过交叉和突变产生下一代线性策略。`,"hill-climb":`爬山搜索只围绕当前最优策略做高斯突变，并接受表现更好的突变体。`,"random-search":`随机搜索独立采样线性策略，只保留历史表现最好的策略作为演示模型。`,"double-dqn":`Double DQN 使用经验回放、在线网络和目标网络来学习动作价值函数。`,"q-learning":`表格 Q-learning 将观察离散化后，用 Bellman 最优性更新学习动作价值。`,sarsa:`SARSA 使用当前探索策略实际选择的下一动作来做 on-policy TD 更新。`,reinforce:`REINFORCE 从完整回合估计折扣回报，并用策略梯度更新随机策略。`}[e.algorithm]),A(`work-label`,{cem:`候选个体`,genetic:`候选个体`,"hill-climb":`突变尝试`,"random-search":`随机尝试`,"double-dqn":`回放池`,"q-learning":`探索率`,sarsa:`探索率`,reinforce:`回合长度`}[e.algorithm]),A(`objective-label`,{cem:`精英均值`,genetic:`精英均值`,"hill-climb":`当前最优`,"random-search":`当前最优`,"double-dqn":`损失`,"q-learning":`TD 误差`,sarsa:`TD 误差`,reinforce:`回报`}[e.algorithm]),A(`control-title`,{cem:`CEM 参数`,genetic:`遗传算法参数`,"hill-climb":`爬山搜索参数`,"random-search":`随机搜索参数`,"double-dqn":`Double DQN 参数`,"q-learning":`Q-learning 参数`,sarsa:`SARSA 参数`,reinforce:`REINFORCE 参数`}[e.algorithm]),y(e.algorithm)}function y(e){let t=e===`cem`||e===`genetic`||e===`hill-climb`||e===`random-search`,n=e===`cem`||e===`genetic`,r=e===`double-dqn`||e===`q-learning`||e===`sarsa`,i=e===`double-dqn`||e===`reinforce`,a=e===`double-dqn`;for(let e of document.querySelectorAll(`.population-control`))e.hidden=!t;for(let e of document.querySelectorAll(`.elite-control`))e.hidden=!n;for(let e of document.querySelectorAll(`.value-control`))e.hidden=!r;for(let e of document.querySelectorAll(`.gradient-control`))e.hidden=!i;for(let e of document.querySelectorAll(`.dqn-control`))e.hidden=!a}function b(){x(o,i,p.render),requestAnimationFrame(b)}function x(e,t,n){n?.kind===`pong`||!n&&f.environment===`pong`?C(e,t,n?.kind===`pong`?n:null):S(e,t,n?.kind===`flappy`?n:null)}function S(e,t,n){let r=t.width,i=t.height;if(e.clearRect(0,0,r,i),e.save(),e.scale(r/800,i/600),e.fillStyle=`#d8edf5`,e.fillRect(0,0,800,600),e.fillStyle=`#806f51`,e.fillRect(0,500,800,100),e.fillStyle=`#5a8d3d`,e.fillRect(0,500,800,10),n){let t=280-n.x;e.save(),e.translate(t,0),e.fillStyle=`#1e9e56`;for(let t of n.pipes)T(e,t.x,0,60,t.gapY,4),e.fill(),T(e,t.x,t.gapY+160,60,500-t.gapY-160,4),e.fill(),e.fillStyle=`#157a43`,e.fillRect(t.x-4,t.gapY-16,68,16),e.fillRect(t.x-4,t.gapY+160,68,16),e.fillStyle=`#1e9e56`;e.fillStyle=`#d64d36`,T(e,n.x,n.y,30,30,6),e.fill(),e.fillStyle=`#fff4c7`,e.fillRect(n.x+19,n.y+8,6,5),e.restore(),e.fillStyle=`rgba(18, 28, 36, 0.78)`,e.font=`600 15px Inter, system-ui, sans-serif`,e.fillText(`得分 ${n.score}`,24,34),e.fillText(`奖励 ${n.lastReward.toFixed(3)}`,24,58)}e.restore()}function C(e,t,n){let r=t.width,i=t.height;e.clearRect(0,0,r,i),e.save(),e.scale(r/800,i/600),e.fillStyle=`#15202a`,e.fillRect(0,0,800,600),e.fillStyle=`#dce6ed`,e.globalAlpha=.28;for(let t=18;t<600;t+=36)e.fillRect(800/2-2,t,4,18);e.globalAlpha=1,e.strokeStyle=`#314350`,e.lineWidth=8,e.strokeRect(4,4,792,592);let a=n?.paddleY??508/2,o=n?.ballX??800*.58,s=n?.ballY??600/2,c=n?.score??0,l=n?.lastReward??0;e.fillStyle=`#f0f6fb`,T(e,36,a,16,92,5),e.fill(),e.fillStyle=`#d64d36`,T(e,o-10,s-10,20,20,10),e.fill(),e.fillStyle=`rgba(247, 251, 255, 0.86)`,e.font=`600 15px Inter, system-ui, sans-serif`,e.fillText(`得分 ${c}`,24,34),e.fillText(`奖励 ${l.toFixed(3)}`,24,58),e.restore()}function w(e,n,r,i){let a=n.width,o=n.height;if(e.clearRect(0,0,a,o),e.fillStyle=`#ffffff`,e.fillRect(0,0,a,o),e.strokeStyle=`#d5dde5`,e.lineWidth=1,e.strokeRect(46,20,a-46-18,o-20-34),e.fillStyle=`#6a7580`,e.font=`12px Inter, system-ui, sans-serif`,e.fillText(t[i].chartLabel,10,18),e.fillText(`步数`,a-46,o-10),r.length<2){e.fillStyle=`#8c98a4`,e.font=`500 14px Inter, system-ui, sans-serif`,e.fillText(`等待评估`,62,54);return}let s=r[0].step,c=r[r.length-1].step,l=Math.max(500,...r.map(e=>e.distance)),u=a-46-18,d=o-20-34;e.beginPath(),r.forEach((t,n)=>{let r=46+(t.step-s)/Math.max(1,c-s)*u,i=20+d-t.distance/l*d;n===0?e.moveTo(r,i):e.lineTo(r,i)}),e.strokeStyle=`#d64d36`,e.lineWidth=2.5,e.stroke(),e.fillStyle=`#28323b`,e.fillText(l.toFixed(0),8,28),e.fillText(r[r.length-1].distance.toFixed(0),a-58,38)}function T(e,t,n,r,i,a){let o=Math.min(a,r/2,i/2);e.beginPath(),e.moveTo(t+o,n),e.lineTo(t+r-o,n),e.quadraticCurveTo(t+r,n,t+r,n+o),e.lineTo(t+r,n+i-o),e.quadraticCurveTo(t+r,n+i,t+r-o,n+i),e.lineTo(t+o,n+i),e.quadraticCurveTo(t,n+i,t,n+i-o),e.lineTo(t,n+o),e.quadraticCurveTo(t,n,t+o,n),e.closePath()}function E(e,t,n,r){let i=document.getElementById(e),a=document.getElementById(t);if(!(i instanceof HTMLInputElement)||!(a instanceof HTMLOutputElement))throw Error(`Missing range control ${e}`);let o=()=>{let e=Number(i.value);a.textContent=`${e}${n}`,r(e)};i.addEventListener(`input`,o),o()}function D(e){let t=document.getElementById(e);if(!(t instanceof HTMLCanvasElement))throw Error(`Missing canvas ${e}`);return t}function O(e){let t=document.getElementById(e);if(!(t instanceof HTMLButtonElement))throw Error(`Missing button ${e}`);return t}function k(e){let t=e.getContext(`2d`);if(!t)throw Error(`Canvas 2D context is unavailable`);return t}function A(e,t){let n=document.getElementById(e);n&&(n.textContent=t)}function j(e){return new Intl.NumberFormat(`en-US`,{maximumFractionDigits:0}).format(e)}