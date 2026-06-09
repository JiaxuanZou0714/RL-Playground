(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(){return{environment:`flappy`,algorithm:`cem`,populationSize:48,eliteSize:8,initialStd:1.2,minStd:.05,stdDecay:.9,maxEpisodeSteps:1200,evalRuns:10,candidatesPerBurst:4,trainBudgetMs:12,replayCapacity:2e4,batchSize:16,warmupSteps:500,gamma:.99,learningRate:.001,epsilonStart:1,epsilonMin:.03,epsilonDecaySteps:12e3,targetUpdateSteps:600,trainEverySteps:2}}function t(e,t,n,r){let i=document.getElementById(e),a=document.getElementById(t);if(!(i instanceof HTMLInputElement)||!(a instanceof HTMLOutputElement))throw Error(`Missing range control ${e}`);let o=()=>{let e=Number(i.value),t=c(i,e);a.textContent=`${t}${n}`,i.setAttribute(`aria-valuenow`,t),i.setAttribute(`aria-valuetext`,`${t}${n}`),r(e)};i.addEventListener(`input`,o),o()}function n(e){let t=document.getElementById(e);if(!(t instanceof HTMLCanvasElement))throw Error(`Missing canvas ${e}`);return t}function r(e){let t=document.getElementById(e);if(!(t instanceof SVGSVGElement))throw Error(`Missing svg ${e}`);return t}function i(e){let t=document.getElementById(e);if(!(t instanceof HTMLButtonElement))throw Error(`Missing button ${e}`);return t}function a(e){let t=e.getContext(`2d`);if(!t)throw Error(`Canvas 2D context is unavailable`);return t}function o(e,t){let n=document.getElementById(e);n&&(n.textContent=t)}function s(e){return new Intl.NumberFormat(`en-US`,{maximumFractionDigits:0}).format(e)}function c(e,t){if(e.step.includes(`.`)){let n=e.step.split(`.`)[1]?.length??0;return t.toFixed(n).replace(/0+$/,``).replace(/\.$/,``)}return String(t)}var l={flappy:{title:`Flappy Bird 示教`,description:`在一个紧凑、确定性的环境中比较标准强化学习算法的训练行为。`,canvasLabel:`Flappy Bird 仿真画面`,chartLabel:`距离`},pong:{title:`Pong 示教`,description:`训练智能体控制球拍跟踪小球、完成回击，并尽量延长每个回合。`,canvasLabel:`Pong 仿真画面`,chartLabel:`回合长度`}},u={cem:`CEM 通过采样一批线性策略、保留精英样本并更新采样分布来直接优化策略。`,genetic:`遗传算法保留精英策略，通过交叉和突变产生下一代线性策略。`,"hill-climb":`爬山搜索只围绕当前最优策略做高斯突变，并接受表现更好的突变体。`,"random-search":`随机搜索独立采样线性策略，只保留历史表现最好的策略作为演示模型。`,"double-dqn":`Double DQN 使用经验回放、在线网络和目标网络来学习动作价值函数。`,"q-learning":`表格 Q-learning 将观察离散化后，用 Bellman 最优性更新学习动作价值。`,sarsa:`SARSA 使用当前探索策略实际选择的下一动作来做 on-policy TD 更新。`,reinforce:`REINFORCE 从完整回合估计折扣回报，并用策略梯度更新随机策略。`},d={cem:`候选个体`,genetic:`候选个体`,"hill-climb":`突变尝试`,"random-search":`随机尝试`,"double-dqn":`回放池`,"q-learning":`探索率`,sarsa:`探索率`,reinforce:`回合长度`},f={cem:`精英均值`,genetic:`精英均值`,"hill-climb":`当前最优`,"random-search":`当前最优`,"double-dqn":`损失`,"q-learning":`TD 误差`,sarsa:`TD 误差`,reinforce:`回报`},p={cem:`CEM 参数`,genetic:`遗传算法参数`,"hill-climb":`爬山搜索参数`,"random-search":`随机搜索参数`,"double-dqn":`Double DQN 参数`,"q-learning":`Q-learning 参数`,sarsa:`SARSA 参数`,reinforce:`REINFORCE 参数`},m=`
  <header class="topbar">
    <div class="brand">
      <span class="brand-name">RL-Playground</span>
      <span class="brand-subtitle">强化学习示教台</span>
    </div>
    <nav class="nav" aria-label="环境">
      <button class="nav-item active" type="button" data-environment="flappy" aria-pressed="true">Flappy Bird</button>
      <button class="nav-item" type="button" data-environment="pong" aria-pressed="false">Pong</button>
    </nav>
  </header>
  <main class="shell">
    <section class="workspace">
      <div class="stage-toolbar">
        <div class="stage-copy">
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
        <div class="simulation-frame">
          <div class="simulation-bar">
            <span>策略演示画面</span>
            <span>800 × 600</span>
          </div>
          <canvas id="game-canvas" width="800" height="600" aria-label="Flappy Bird 仿真画面"></canvas>
        </div>
        <aside class="metrics" aria-labelledby="metrics-title">
          <h2 id="metrics-title" class="metrics-title">训练指标</h2>
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
      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">评估曲线</span>
          <span class="chart-subtitle" id="chart-subtitle">纵轴固定 0–2000，横轴为环境步数</span>
        </div>
        <svg id="chart-svg" aria-label="训练过程中的评估距离" role="img"></svg>
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
    </section>
  </main>
  <section class="teaching-section" aria-labelledby="algorithm-teaching-title">
    <div class="teaching-header">
      <div>
        <h2 id="algorithm-teaching-title">算法说明</h2>
        <p>训练、评估和演示在同一屏：先用"训练"让模型快速更新，再用"演示"观察当前策略在正常速度下的行为。</p>
      </div>
      <div class="notation-box">
        <strong>统一符号</strong>
        <span>状态/观察为 <code>s</code>，动作为 <code>a</code>，奖励为 <code>r</code>，折扣因子为 <code>γ</code>，模型参数为 <code>θ</code>。连续状态被表格型算法离散化为 <code>ŝ</code>。</span>
      </div>
    </div>
    <div class="algorithm-grid">

      <div class="algo-group evolution">
        <div class="algo-group-header">
          <span class="algo-group-dot"></span>
          <span class="algo-group-label">进化计算</span>
          <p class="algo-group-desc">直接搜索策略参数空间，无需梯度；依靠种群或个体间的变异和选择找到高适应度策略。</p>
        </div>
        <div class="algo-cards">
          <article class="algorithm-card">
            <h3>CEM 交叉熵方法</h3>
            <p>CEM 不学习价值函数，而是直接搜索线性的策略参数。网络给每个动作打分，然后贪心地选择最高分。</p>
            <div class="formula">
              <math display="block" aria-label="动作等于让线性策略分数最大的动作">
                <mi>a</mi><mo>=</mo>
                <munder><mi>argmax</mi><mi>a</mi></munder>
                <mo>(</mo><msub><mi>w</mi><mi>a</mi></msub><mo>·</mo><mi>s</mi><mo>+</mo><msub><mi>b</mi><mi>a</mi></msub><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="CEM 用精英集合更新均值和标准差">
                <mi>μ</mi><mo>←</mo><mi>mean</mi><mo>(</mo><mi>E</mi><mo>)</mo>
                <mo>,</mo>
                <mi>σ</mi><mo>←</mo><mi>max</mi><mo>(</mo><msub><mi>σ</mi><mi>min</mi></msub><mo>,</mo><mi>decay</mi><mo>·</mo><mi>std</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>)</mo>
              </math>
            </div>
            <p>保留表现最好的精英，将正态分布的均值和标准差向精英收缩。收敛快，参数少，适合短回合控制任务。</p>
            <p class="watch-point"><strong>观察重点</strong><span>候选个体代表代数进度，目标值是精英平均表现。它是此应用的强势基线。</span></p>
          </article>

          <article class="algorithm-card">
            <h3>Genetic 遗传算法</h3>
            <p>通过模拟自然界的进化、交叉与变异过程迭代出最优模型，适合解释直观的黑盒优化。</p>
            <div class="formula">
              <math display="block" aria-label="遗传算法保留适应度最高的精英集合">
                <mi>E</mi><mo>=</mo><msub><mi>top</mi><mi>k</mi></msub><mo>{</mo><mi>F</mi><mo>(</mo><msub><mi>θ</mi><mi>i</mi></msub><mo>)</mo><mo>}</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="子代由两个父代交叉并带高斯突变得到">
                <msub><mi>θ</mi><mi>child</mi></msub>
                <mo>=</mo>
                <mi>β</mi><msub><mi>θ</mi><mi>p1</mi></msub><mo>+</mo><mo>(</mo><mn>1</mn><mo>-</mo><mi>β</mi><mo>)</mo><msub><mi>θ</mi><mi>p2</mi></msub>
                <mo>+</mo><mi>σ</mi><mi>ε</mi>
              </math>
            </div>
            <p>每一代优先保护精英个体复制，随后的子代在精英父母间进行权重插值（交叉），并带有一定的高斯噪声（变异）。</p>
            <p class="watch-point"><strong>观察重点</strong><span>不同于 CEM 的分布拟合，它保留个体多样性，但随机性更剧烈，有时收敛不如 CEM 稳定。</span></p>
          </article>
        </div>
      </div>

      <div class="algo-group search">
        <div class="algo-group-header">
          <span class="algo-group-dot"></span>
          <span class="algo-group-label">局部搜索 / 基线</span>
          <p class="algo-group-desc">维护单个策略或独立采样，用最小代价探索参数空间；常作对比基线或教学起点。</p>
        </div>
        <div class="algo-cards">
          <article class="algorithm-card">
            <h3>Hill Climbing 爬山搜索</h3>
            <p>只维护单个当前最优策略，不断在其附近试探新解。变异体得分更高则接纳，否则丢弃。</p>
            <div class="formula">
              <math display="block" aria-label="爬山搜索围绕当前最优参数采样突变体">
                <msup><mi>θ</mi><mo>′</mo></msup><mo>=</mo><msub><mi>θ</mi><mi>best</mi></msub><mo>+</mo><mi>σ</mi><mi>ε</mi>
                <mo>,</mo><mi>ε</mi><mo>∼</mo><mi>𝒩</mi><mo>(</mo><mn>0</mn><mo>,</mo><mi>I</mi><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="只有更优突变体会被接受">
                <msub><mi>θ</mi><mi>best</mi></msub><mo>←</mo><msup><mi>θ</mi><mo>′</mo></msup>
                <mtext> if </mtext>
                <mi>F</mi><mo>(</mo><msup><mi>θ</mi><mo>′</mo></msup><mo>)</mo><mo>&gt;</mo><mi>F</mi><mo>(</mo><msub><mi>θ</mi><mi>best</mi></msub><mo>)</mo>
              </math>
            </div>
            <p>不利用种群交叉和均值，资源开销极小。早期突变范围决定了能否跳出局部困境。</p>
            <p class="watch-point"><strong>观察重点</strong><span>"参数更新"次数指示爬山者前进了几步。它简单高速，却惊人地管用。</span></p>
          </article>

          <article class="algorithm-card">
            <h3>Random 随机搜索</h3>
            <p>每一代独立采样不相关的新参数。它是无梯度强化学习的朴素下界，用来验证环境难度。</p>
            <div class="formula">
              <math display="block" aria-label="随机搜索独立采样策略参数">
                <msub><mi>θ</mi><mi>i</mi></msub><mo>∼</mo><mi>𝒩</mi><mo>(</mo><mn>0</mn><mo>,</mo><msup><mi>σ</mi><mn>2</mn></msup><mi>I</mi><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="随机搜索保留历史最高适应度策略">
                <msub><mi>θ</mi><mi>best</mi></msub><mo>=</mo>
                <munder><mi>argmax</mi><mi>i</mi></munder>
                <mi>F</mi><mo>(</mo><msub><mi>θ</mi><mi>i</mi></msub><mo>)</mo>
              </math>
            </div>
            <p>从始至终毫无学习，只靠运气撞见高分网络。其效率直接反映了有用策略在参数空间中的密度。</p>
            <p class="watch-point"><strong>观察重点</strong><span>若随机搜索与复杂 RL 表现相近，说明环境过于简单；否则可看出深度模型和优化算法的贡献。</span></p>
          </article>
        </div>
      </div>

      <div class="algo-group deep-rl">
        <div class="algo-group-header">
          <span class="algo-group-dot"></span>
          <span class="algo-group-label">深度强化学习</span>
          <p class="algo-group-desc">用神经网络拟合动作价值函数，结合经验回放与目标网络稳定训练。</p>
        </div>
        <div class="algo-cards">
          <article class="algorithm-card">
            <h3>Double DQN</h3>
            <p>经典值函数方法，学习在状态 s 下执行各动作 a 能带来的未来回报。利用目标网络缓解过高估计问题。</p>
            <div class="formula">
              <math display="block" aria-label="在线网络选择下一状态中的最大动作">
                <msup><mi>a</mi><mo>*</mo></msup><mo>=</mo>
                <munder><mi>argmax</mi><mi>a</mi></munder>
                <msub><mi>Q</mi><mi>θ</mi></msub><mo>(</mo><msup><mi>s</mi><mo>′</mo></msup><mo>,</mo><mi>a</mi><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="Double DQN 使用 Huber 损失">
                <mi>L</mi><mo>=</mo><mi>Huber</mi><mo>(</mo>
                <msub><mi>Q</mi><mi>θ</mi></msub><mo>(</mo><mi>s</mi><mo>,</mo><mi>a</mi><mo>)</mo>
                <mo>-</mo><mo>(</mo><mi>r</mi><mo>+</mo><mi>γ</mi>
                <msub><mi>Q</mi><msup><mi>θ</mi><mo>-</mo></msup></msub>
                <mo>(</mo><msup><mi>s</mi><mo>′</mo></msup><mo>,</mo><msup><mi>a</mi><mo>*</mo></msup><mo>)</mo><mo>)</mo><mo>)</mo>
              </math>
            </div>
            <p>使用多层全连接网络和经验回放池，搭配 Adam 优化器完成学习，是非常主流的异策略方法。</p>
            <p class="watch-point"><strong>观察重点</strong><span>初期预热和探索很重要；一旦 Loss 明显下降且 Q 值合理建立，评估曲线会稳定上升。</span></p>
          </article>
        </div>
      </div>

      <div class="algo-group tabular">
        <div class="algo-group-header">
          <span class="algo-group-dot"></span>
          <span class="algo-group-label">表格型方法</span>
          <p class="algo-group-desc">将连续观察离散化为网格，用有限大小的 Q 表迭代估计动作价值；适合理解 TD 算法的核心机制。</p>
        </div>
        <div class="algo-cards">
          <article class="algorithm-card">
            <h3>Tabular Q-learning</h3>
            <p>离线 (Off-policy) 控制的先驱，将连续坐标打上网格，用一张表记录每个格子的价值并直接迭代。</p>
            <div class="formula">
              <math display="block" aria-label="Q-learning 的 TD 误差">
                <mi>δ</mi><mo>=</mo><mi>r</mi><mo>+</mo><mi>γ</mi>
                <munder><mi>max</mi><msup><mi>a</mi><mo>′</mo></msup></munder>
                <mi>Q</mi><mo>(</mo><msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup><mo>,</mo><msup><mi>a</mi><mo>′</mo></msup><mo>)</mo>
                <mo>-</mo><mi>Q</mi><mo>(</mo><mover><mi>s</mi><mo>^</mo></mover><mo>,</mo><mi>a</mi><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="Q-learning 表格更新">
                <mi>Q</mi><mo>(</mo><mover><mi>s</mi><mo>^</mo></mover><mo>,</mo><mi>a</mi><mo>)</mo>
                <mo>←</mo>
                <mi>Q</mi><mo>(</mo><mover><mi>s</mi><mo>^</mo></mover><mo>,</mo><mi>a</mi><mo>)</mo><mo>+</mo><mi>α</mi><mi>δ</mi>
              </math>
            </div>
            <p>运算飞快，但连续空间的细节信息丢失严重，常在稍需精度的物理环境中折戟。</p>
            <p class="watch-point"><strong>观察重点</strong><span>用来感受"状态离散化"不足带来的学习瓶颈，即使 TD 近似完美，连续环境也会使其受限。</span></p>
          </article>

          <article class="algorithm-card">
            <h3>SARSA</h3>
            <p>同策略的表格型 TD 控制方法。对未来步价值的估计也用自身策略即将采样的动作，而非贪心最大值。</p>
            <div class="formula">
              <math display="block" aria-label="SARSA 按当前策略选择下一动作">
                <msup><mi>a</mi><mo>′</mo></msup><mo>∼</mo><mi>π</mi><mo>(</mo><mo>·</mo><mo>|</mo><msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="SARSA 的 TD 误差">
                <mi>δ</mi><mo>=</mo><mi>r</mi><mo>+</mo><mi>γ</mi>
                <mi>Q</mi><mo>(</mo><msup><mover><mi>s</mi><mo>^</mo></mover><mo>′</mo></msup><mo>,</mo><msup><mi>a</mi><mo>′</mo></msup><mo>)</mo>
                <mo>-</mo><mi>Q</mi><mo>(</mo><mover><mi>s</mi><mo>^</mo></mover><mo>,</mo><mi>a</mi><mo>)</mo>
              </math>
            </div>
            <p>由于考虑到自身探索噪音的存在，算出的动作常常比 Q-learning 更加保守和安全。</p>
            <p class="watch-point"><strong>观察重点</strong><span>结合 Q-learning 比较同/异策略行为，SARSA 谨慎稳妥但学习上限受探索策略拖累。</span></p>
          </article>
        </div>
      </div>

      <div class="algo-group pg-rl">
        <div class="algo-group-header">
          <span class="algo-group-dot"></span>
          <span class="algo-group-label">策略梯度</span>
          <p class="algo-group-desc">直接对预期回报求梯度并更新随机策略网络，不依赖价值函数；是深度策略优化方法的起点。</p>
        </div>
        <div class="algo-cards">
          <article class="algorithm-card">
            <h3>REINFORCE</h3>
            <p>策略梯度的开山之作，让网络直接输出选择各动作的概率值，然后按整轮折扣回报加权反传。</p>
            <div class="formula">
              <math display="block" aria-label="REINFORCE 使用 softmax 随机策略">
                <msub><mi>π</mi><mi>θ</mi></msub><mo>(</mo><mi>a</mi><mo>|</mo><mi>s</mi><mo>)</mo>
                <mo>=</mo><mi>softmax</mi><mo>(</mo><msub><mi>w</mi><mi>a</mi></msub><mo>·</mo><mi>s</mi><mo>+</mo><msub><mi>b</mi><mi>a</mi></msub><mo>)</mo>
              </math>
            </div>
            <div class="formula">
              <math display="block" aria-label="REINFORCE 的负对数似然损失">
                <mi>L</mi><mo>(</mo><mi>θ</mi><mo>)</mo><mo>=</mo><mo>-</mo>
                <munder><mo>Σ</mo><mi>t</mi></munder>
                <msub><mi>G</mi><mi>t</mi></msub>
                <mi>log</mi><msub><mi>π</mi><mi>θ</mi></msub><mo>(</mo><msub><mi>a</mi><mi>t</mi></msub><mo>|</mo><msub><mi>s</mi><mi>t</mi></msub><mo>)</mo>
              </math>
            </div>
            <p>简单纯粹。没有 Baseline 函数来降低方差，在具有高度不确定性的玩具环境中往往震荡严重。</p>
            <p class="watch-point"><strong>观察重点</strong><span>重点用于理解策略网络更新原理；若要高效通关，其他方法更合适。</span></p>
          </article>
        </div>
      </div>

    </div>
  </section>
`;function h(e,t,n,r){n?.kind===`pong`||!n&&r===`pong`?v(e,t,n?.kind===`pong`?n:null):_(e,t,n?.kind===`flappy`?n:null)}function g(e,t,n){let r=1200,i=r-48-16,a=t.length>0?Math.max(...t.map(e=>e.distance)):0,o=S(Math.max(a,500),n),s=t.length>0?t[0].step:0,c=(t.length>0?t[t.length-1].step:2e5)-s||1,u=e=>48+(e-s)/c*i,d=e=>292-Math.min(e/o,1)*276;e.setAttribute(`viewBox`,`0 0 ${r} 320`),e.setAttribute(`preserveAspectRatio`,`none`),e.innerHTML=``;let f=w(`defs`),p=w(`linearGradient`,{id:`cg`,x1:`0`,y1:`0`,x2:`0`,y2:`1`});p.append(w(`stop`,{offset:`0%`,"stop-color":`rgba(62,160,100,0.12)`}),w(`stop`,{offset:`100%`,"stop-color":`rgba(62,160,100,0)`})),f.append(p),e.append(f),e.append(w(`rect`,{x:`48`,y:`16`,width:`1136`,height:`276`,fill:`none`,stroke:`rgba(0,0,0,0.08)`,"stroke-width":`1`}));for(let t=0;t<=4;t+=1){let n=o*t/4,r=292-276*t/4;t>0&&e.append(w(`line`,{x1:`48`,y1:String(r),x2:`1184`,y2:String(r),stroke:`rgba(0,0,0,0.05)`,"stroke-width":`1`}));let i=w(`text`,{x:`43`,y:String(r),"text-anchor":`end`,"dominant-baseline":`middle`,"font-size":`11`,fill:`rgba(0,0,0,0.40)`});i.textContent=n>=1e3?`${(n/1e3).toFixed(n%1e3==0?0:1)}k`:String(n),e.append(i)}for(let t=0;t<=4;t+=1){let n=s+c*t/4,r=48+i*t/4,a=w(`text`,{x:String(r),y:`308`,"text-anchor":`middle`,"font-size":`11`,fill:`rgba(0,0,0,0.40)`});a.textContent=C(n),e.append(a)}let m=w(`text`,{x:`52`,y:`27`,"font-size":`11`,fill:`rgba(0,0,0,0.30)`});if(m.textContent=l[n].chartLabel,e.append(m),t.length<2){let t=w(`text`,{x:`616`,y:`154`,"text-anchor":`middle`,"dominant-baseline":`middle`,"font-size":`13`,fill:`rgba(0,0,0,0.20)`});t.textContent=`等待评估数据…`,e.append(t);return}let h=y(t),g=t.map(e=>`${u(e.step)},${d(e.distance)}`).join(` `),_=h.map(e=>`${u(e.step)},${d(e.distance)}`).join(` `);e.append(w(`polyline`,{points:g,fill:`none`,stroke:`rgba(62,160,100,0.22)`,"stroke-width":`1`}));let v=u(h[0].step),b=h[h.length-1];e.append(w(`polygon`,{points:`${_} ${u(b.step)},292 ${v},292`,fill:`url(#cg)`})),e.append(w(`polyline`,{points:_,fill:`none`,stroke:`#3ea064`,"stroke-width":`2`}));let x=t[t.length-1].distance,T=u(t[t.length-1].step),E=d(x);e.append(w(`circle`,{cx:String(T),cy:String(E),r:`3`,fill:`#3ea064`}));let D=T>1144?`end`:`start`,O=w(`text`,{x:String(T+(T>1144?-6:6)),y:String(E-4),"text-anchor":D,"font-size":`11`,fill:`rgba(0,0,0,0.55)`});O.textContent=x.toFixed(0),e.append(O)}function _(e,t,n){let r=t.width,i=t.height;if(e.clearRect(0,0,r,i),e.save(),e.scale(r/800,i/600),e.fillStyle=`#111822`,e.fillRect(0,0,800,600),e.fillStyle=`#1a2430`,e.fillRect(0,500,800,100),e.fillStyle=`#243040`,e.fillRect(0,500,800,6),n){let t=280-n.x;e.save(),e.translate(t,0),e.fillStyle=`#2a6b5a`;for(let t of n.pipes)T(e,t.x,0,60,t.gapY,4),e.fill(),T(e,t.x,t.gapY+160,60,500-t.gapY-160,4),e.fill(),e.fillStyle=`#1e5244`,e.fillRect(t.x-4,t.gapY-14,68,14),e.fillRect(t.x-4,t.gapY+160,68,14),e.fillStyle=`#2a6b5a`;e.fillStyle=`#5ed29c`,T(e,n.x,n.y,30,30,6),e.fill(),e.fillStyle=`rgba(255,255,255,0.4)`,e.fillRect(n.x+19,n.y+8,5,4),e.restore(),e.fillStyle=`rgba(94, 210, 156, 0.6)`,e.font=`600 13px Inter, system-ui, sans-serif`,e.fillText(`得分 ${n.score}`,18,28),e.fillText(`奖励 ${n.lastReward.toFixed(3)}`,18,48)}e.restore()}function v(e,t,n){let r=t.width,i=t.height;e.clearRect(0,0,r,i),e.save(),e.scale(r/800,i/600),e.fillStyle=`#15202a`,e.fillRect(0,0,800,600),e.fillStyle=`#dce6ed`,e.globalAlpha=.28;for(let t=18;t<600;t+=36)e.fillRect(800/2-2,t,4,18);e.globalAlpha=1,e.strokeStyle=`#314350`,e.lineWidth=8,e.strokeRect(4,4,792,592);let a=n?.paddleY??508/2,o=n?.ballX??800*.58,s=n?.ballY??600/2,c=n?.score??0,l=n?.lastReward??0;e.fillStyle=`#5ed29c`,T(e,36,a,16,92,5),e.fill(),e.fillStyle=`rgba(255, 255, 255, 0.75)`,T(e,o-10,s-10,20,20,10),e.fill(),e.fillStyle=`rgba(247, 251, 255, 0.86)`,e.font=`600 15px Inter, system-ui, sans-serif`,e.fillText(`得分 ${c}`,24,34),e.fillText(`奖励 ${l.toFixed(3)}`,24,58),e.restore()}function y(e){let t=.12,n=e[0].distance;return e.map(e=>(n=n*(1-t)+e.distance*t,{step:e.step,distance:n}))}var b=`http://www.w3.org/2000/svg`,x={};function S(e,t){let n=x[t]??0;if(e<=n)return n;let r=e>1e4?1e3:500;return x[t]=Math.ceil(e/r)*r,x[t]}function C(e){return e===0?`0`:e>=1e6?`${(e/1e6).toFixed(e%1e6==0?0:1)}M`:e>=1e3?`${(e/1e3).toFixed(e%1e3==0?0:1)}k`:String(e)}function w(e,t={}){let n=document.createElementNS(b,e);for(let[e,r]of Object.entries(t))n.setAttribute(e,r);return n}function T(e,t,n,r,i,a){let o=Math.min(a,r/2,i/2);e.beginPath(),e.moveTo(t+o,n),e.lineTo(t+r-o,n),e.quadraticCurveTo(t+r,n,t+r,n+o),e.lineTo(t+r,n+i-o),e.quadraticCurveTo(t+r,n+i,t+r-o,n+i),e.lineTo(t+o,n+i),e.quadraticCurveTo(t,n+i,t,n+i-o),e.lineTo(t,n+o),e.quadraticCurveTo(t,n,t+o,n),e.closePath()}var E=new Worker(new URL(``+new URL(`trainer.worker-DFhZaxUy.js`,import.meta.url).href,``+import.meta.url),{type:`module`}),D=document.querySelector(`#app`);if(!D)throw Error(`Missing #app container`);D.innerHTML=m;var O=n(`game-canvas`),k=r(`chart-svg`),A=a(O),j=i(`toggle-run`),M=i(`toggle-demo`),N=i(`reset-run`),P=Array.from(document.querySelectorAll(`[data-environment]`)),F=e(),I={running:!1,demoRunning:!1,stats:{environment:F.environment,algorithm:F.algorithm,steps:0,episodes:0,updates:0,workItem:0,bestDistance:0,bestEvalDistance:0,objective:0,exploration:F.initialStd,replaySize:0,sps:0},render:null,evalHistory:[]};t(`population-size`,`population-size-output`,``,e=>{R({populationSize:e})}),t(`elite-size`,`elite-size-output`,``,e=>{R({eliteSize:e})}),t(`max-episode-steps`,`max-episode-steps-output`,``,e=>{R({maxEpisodeSteps:e})}),t(`learning-rate`,`learning-rate-output`,``,e=>{R({learningRate:e})}),t(`epsilon-decay`,`epsilon-decay-output`,``,e=>{R({epsilonDecaySteps:e})}),t(`batch-size`,`batch-size-output`,``,e=>{R({batchSize:e})}),t(`train-budget`,`train-budget-output`,` ms`,e=>{R({trainBudgetMs:e})});for(let e of P)e.addEventListener(`click`,()=>{let t=G(e.dataset.environment);!t||t===F.environment||R({environment:t})});var L=document.getElementById(`algorithm-select`);if(!(L instanceof HTMLSelectElement))throw Error(`Missing algorithm select`);L.addEventListener(`change`,()=>{R({algorithm:L.value})}),j.addEventListener(`click`,()=>{E.postMessage({type:I.running?`pause`:`start`})}),M.addEventListener(`click`,()=>{E.postMessage({type:I.demoRunning?`pause-demo`:`start-demo`})}),N.addEventListener(`click`,()=>{E.postMessage({type:`reset`,config:F})}),E.onmessage=e=>{let t=e.data;t.type===`state`&&(I.running=t.running,I.demoRunning=t.demoRunning,I.stats=t.stats,I.render=t.render,I.evalHistory=t.evalHistory,z(),g(k,I.evalHistory,I.stats.environment))},B(F.environment),E.postMessage({type:`reset`,config:F}),requestAnimationFrame(W);function R(e){Object.assign(F,e),E.postMessage({type:`config`,config:e})}function z(){j.textContent=I.running?`暂停训练`:`训练`,M.textContent=I.demoRunning?`停止演示`:`演示`,M.classList.toggle(`secondary-active`,I.demoRunning),o(`steps`,s(I.stats.steps)),o(`episodes`,s(I.stats.episodes)),o(`updates`,s(I.stats.updates)),o(`work-item`,s(I.stats.workItem)),o(`best-distance`,I.stats.bestDistance.toFixed(0)),o(`best-eval`,I.stats.bestEvalDistance.toFixed(0)),o(`objective`,I.stats.objective.toFixed(3)),o(`sps`,I.stats.sps.toFixed(0)),V(I.stats.algorithm),B(I.stats.environment)}function B(e){let t=l[e];o(`environment-title`,t.title),o(`environment-description`,t.description),O.setAttribute(`aria-label`,t.canvasLabel),k.setAttribute(`aria-label`,`训练过程中的评估${t.chartLabel}`);for(let t of P){let n=t.dataset.environment===e;t.classList.toggle(`active`,n),t.setAttribute(`aria-pressed`,String(n))}}function V(e){o(`algorithm-note`,u[e]),o(`work-label`,d[e]),o(`objective-label`,f[e]),o(`control-title`,p[e]),H(e)}function H(e){let t=e===`cem`||e===`genetic`||e===`hill-climb`||e===`random-search`,n=e===`cem`||e===`genetic`,r=e===`double-dqn`||e===`q-learning`||e===`sarsa`,i=e===`double-dqn`||e===`reinforce`,a=e===`double-dqn`;U(`.population-control`,!t),U(`.elite-control`,!n),U(`.value-control`,!r),U(`.gradient-control`,!i),U(`.dqn-control`,!a)}function U(e,t){for(let n of document.querySelectorAll(e))n.hidden=t}function W(){h(A,O,I.render,F.environment),requestAnimationFrame(W)}function G(e){return e===`flappy`||e===`pong`?e:null}