import React, { useState } from 'react';
import { X, Save, Zap, Info, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookRatingModalProps {
  onClose: () => void;
  onSave: (ratingData: BookRatingData) => void;
  showToast: (msg: string, type: ToastType) => void;
  initialData?: BookRatingData;
}

export interface BookRatingData {
  book_name: string;
  book_author: string;
  book_platform: string;
  book_category: string;
  reviewer_name: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
  // 新增
  serial_status: 'finished' | 'ongoing' | 'hiatus';
  recommendation_tag: 'recommend' | 'warn';
  book_intro: string;
  book_link: string;
  book_characters: { name: string; role: string; avatar?: string; illustration_url?: string }[];
}

const BOOK_CATEGORIES = [
  '热血竞技','西幻史诗', '姼想奇幻', '科幻未来','恐怖灵异','无限快穿','性别战争','年代重制',
  '悬疑推理', '东方架空', '校园青春', '职场商战', '武侠仙侠', '其他',
];

const PRINCIPLES = [
  { id: 'p1', text: '作者预收/写过/阅读男主文、bl、言情等非4B小说。' },
  { id: 'p2', text: '连载中/断更/卡v/坑文等操作。' },
  { id: 'p3', text: '文笔差 / 一般，剧情设定欠缺。' },
  { id: 'p4', text: '评论区磕cp、吵架，作者关闭评论区等。' },
  { id: 'p5', text: '作者现实其他骚操作（已婚、提男友、拒绝激女读者等）。' },
  { id: 'p6', text: '描写氛围、语言、过于暧昧，女角色之间（非女主）关系有百合倾向。' },
  { id: 'p7', text: '女男比例低于2：1。' },
  { id: 'p8', text: '随父姓，默认任何角色随父姓，不单指主角，不指出也不批判也没改变。' },
  { id: 'p9', text: '女性角色塑造不用心、刻板印象（取名随意、脸谱化、平面化）。' },
  { id: 'p10', text: '服美役（白幼瘦、面部、高跟鞋、胸臀腿特写、衣服配饰等外貌方面的描写）。' },
  { id: 'p11', text: '驴竞、拉踩其他女角色。' },
  { id: 'p12', text: '忽略女性困难处境、物化女性。' },
  { id: 'p13', text: '性别认知障碍，自称哥、爸、爷、弟等，女扮男装，女角色被称为先生等。' },
  { id: 'p14', text: '扶持男性、接男儿，有男人分享女角色胜利果实/成果/遗产等。' },
  { id: 'p15', text: '男性角色与女性角色存在单向/双向性缘。' },
  { id: 'p16', text: '美化男性（母父对比、男性深情、男性友情、男性导师等）、偏爱男性。' },
  { id: 'p17', text: '男性角色有高光、有成长线。' },
  { id: 'p18', text: '掺腐（非批判）。' },
  { id: 'p19', text: '存在厌女词、辱女词（s|b、m|d、cao、草字头等，包括但不限于这类词）。' },
  { id: 'p20', text: '存在男本位词:男|女、父|母、师父、师叔、徒弟等，嫖娼、妓女、嫁娶、奴才、婢女等偏旁为女的贬义词。' },
  { id: 'p21', text: '用性侵、造黄谣等方式x惩罚女性、描写角色x行为等。' },
  { id: 'p22', text: '过度渲染女性苦楚/雄堕，但反抗/觉醒内容占比很少。' },
  { id: 'p23', text: '是否有提到推广或倡导女权的思想和行为【没有需扣分】。', reverseScore: true },
  { id: 'p24', text: '是否有明确的反男权思想和行为【没有需扣分】。', reverseScore: true },
  { id: 'p25', text: '是否默认女性为第一性【没有需扣分】。', reverseScore: true },
];

export default function BookRatingModal({ onClose, onSave, showToast, initialData }: BookRatingModalProps) {
  const [bookName, setBookName] = useState(initialData?.book_name || '');
  const [bookAuthor, setBookAuthor] = useState(initialData?.book_author || '');
  const [bookPlatform, setBookPlatform] = useState(initialData?.book_platform || '');
  const [bookCategory, setBookCategory] = useState(initialData?.book_category || '');
  const [reviewerName, setReviewerName] = useState(initialData?.reviewer_name || '');
  const [impressedScore, setImpressedScore] = useState<number | string>(initialData?.impressed_score ?? 10);
  const [principleScores, setPrincipleScores] = useState<{ [key: string]: 'yes' | 'no' | null }>(
    initialData?.principle_scores || {}
  );
  const [principleRemarks, setPrincipleRemarks] = useState<{ [key: string]: string }>(
    initialData?.principle_remarks || {}
  );
  const [extraDeduction, setExtraDeduction] = useState(initialData?.extra_deduction || 0);
  const [extraRemark, setExtraRemark] = useState(initialData?.extra_remark || '');
  const [showRules, setShowRules] = useState(false);

  // 新增字段 state
  const [serialStatus, setSerialStatus] = useState<'finished' | 'ongoing' | 'hiatus'>(
    initialData?.serial_status || 'ongoing'
  );
  const [recommendationTag, setRecommendationTag] = useState<'recommend' | 'warn'>(
    initialData?.recommendation_tag || 'recommend'
  );
  const [bookIntro, setBookIntro] = useState(initialData?.book_intro || '');
  const [bookLink, setBookLink] = useState(initialData?.book_link || '');
  const [bookCharacters, setBookCharacters] = useState<{ name: string; role: string }[]>(
    initialData?.book_characters || [{ name: '', role: '女主' }]
  );

  const calculateFinalScore = () => {
    let deductions = 0;
    const baseScore = Number(impressedScore) || 0;
    PRINCIPLES.forEach((p) => {
      const answer = principleScores[p.id];
      if (p.reverseScore) { if (answer === 'no') deductions += 1; }
      else { if (answer === 'yes') deductions += 1; }
    });
    return Math.max(0, baseScore - deductions - extraDeduction);
  };

  const finalScore = calculateFinalScore();

  const quickFillPerfect = () => {
    const perfectScores: { [key: string]: 'yes' | 'no' } = {};
    PRINCIPLES.forEach(p => { perfectScores[p.id] = p.reverseScore ? 'yes' : 'no'; });
    setPrincipleScores(perfectScores);
    setImpressedScore(10);
    setExtraDeduction(0);
    showToast('已完成一键填选', 'info');
  };

  // 人物增删改
  const addCharacter = () => {
    setBookCharacters(prev => [...prev, { name: '', role: '女配' }]);
  };
  const removeCharacter = (idx: number) => {
    setBookCharacters(prev => prev.filter((_, i) => i !== idx));
  };
  const updateCharacter = (idx: number, field: 'name' | 'role', value: string) => {
    setBookCharacters(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleSave = () => {
    if (!bookName.trim() || !bookAuthor.trim()) return showToast('请完善书名和作者', 'error');
    onSave({
      book_name: bookName,
      book_author: bookAuthor,
      book_platform: bookPlatform,
      book_category: bookCategory,
      reviewer_name: reviewerName || '匿名发帖者',
      impressed_score: Number(impressedScore),
      principle_scores: principleScores,
      principle_remarks: principleRemarks,
      extra_deduction: extraDeduction,
      extra_remark: extraRemark,
      final_score: finalScore,
      // 新增
      serial_status: serialStatus,
      recommendation_tag: recommendationTag,
      book_intro: bookIntro,
      book_link: bookLink,
      book_characters: bookCharacters.filter(c => c.name.trim()),
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden text-zinc-900">

      {/* ── 顶栏 ── */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">当前评分</span>
          <span className="text-base font-bold text-zinc-900">{finalScore.toFixed(1)}</span>
          <span className="mx-2 text-zinc-200 select-none">|</span>
          <button
            onClick={quickFillPerfect}
            className="flex items-center gap-1 px-2.5 py-1 border border-zinc-200 rounded text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            一键填选
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

          {/* 评分规则（折叠） */}
          <section className="bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100">
            <button
              onClick={() => setShowRules(!showRules)}
              className="w-full flex items-center justify-between p-5 hover:bg-zinc-100 transition-colors"
            >
              <div className="flex items-center gap-3 font-bold text-base text-zinc-600">
                <Info className="w-5 h-5" /> 📋 评分规则
              </div>
              {showRules ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showRules && (
              <div className="px-6 pb-6 pt-2 text-base text-zinc-700 leading-relaxed border-t border-zinc-200/50 space-y-3">
                <p><strong>1. 打分为减分制。</strong></p>
                <p>完结小说满分为10分，读者根据阅读后体验和感受，给一个印象得分，然后再根据组规进行减分。</p>
                <p>即最终得分 = 印象分 - 减分项，最终得分 ≤ 10分。【谨慎打8分以上，禁止分数膨胀】</p>
                <p><strong>2. 打分规则。</strong></p>
                <p>各项基础扣分分值为1分，情节严重的可以增加扣分分值，无上限。必须列出各项减分项存在与否。</p>
                <p className="text-red-600 font-bold">❗❗❗注意：没有明确标注/提出的、不完全的、模棱两可的即需要扣分，请各位打分人严格执行！！</p>
              </div>
            )}
          </section>

          {/* 基本信息 */}
          <section>
            <p className="text-xs text-zinc-400 mb-4 pb-2 border-b border-zinc-100">基本信息</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">

              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">书名 <span className="text-red-400">*</span></label>
                <input
                  type="text" value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="输入书名"
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">作者 <span className="text-red-400">*</span></label>
                <input
                  type="text" value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="输入作者"
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">打分人</label>
                <input
                  type="text" value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="默认为发帖者"
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">平台</label>
                <input
                  type="text" value={bookPlatform}
                  onChange={(e) => setBookPlatform(e.target.value)}
                  placeholder="晋江、番茄等"
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">书籍分类</label>
                <select
                  value={bookCategory} onChange={(e) => setBookCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors text-zinc-700 bg-white"
                >
                  <option value="">请选择</option>
                  {BOOK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 新增：连载状态 */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">连载状态</label>
                <div className="flex gap-2">
                  {(['ongoing', 'finished', 'hiatus'] as const).map(s => {
                    const label = { ongoing: '连载中', finished: '完结', hiatus: '断更' }[s];
                    return (
                      <button
                        key={s} type="button"
                        onClick={() => setSerialStatus(s)}
                        className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                          serialStatus === s
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 新增：推荐/排雷 */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">推荐/排雷</label>
                <div className="flex gap-2">
                  {(['recommend', 'warn'] as const).map(t => {
                    const label = { recommend: '推荐', warn: '排雷' }[t];
                    return (
                      <button
                        key={t} type="button"
                        onClick={() => setRecommendationTag(t)}
                        className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                          recommendationTag === t
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 新增：简介 */}
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">书籍简介</label>
                <textarea
                  value={bookIntro}
                  onChange={(e) => setBookIntro(e.target.value)}
                  placeholder="简短介绍书的内容..."
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300 resize-none h-20"
                />
              </div>


              {/* 新增：主要人物 */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400">主要人物</label>
                  <button
                    type="button" onClick={addCharacter}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加人物
                  </button>
                </div>
                <div className="space-y-2">
                  {bookCharacters.map((char, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text" value={char.name}
                        onChange={(e) => updateCharacter(idx, 'name', e.target.value)}
                        placeholder="人物名"
                        className="flex-1 px-3 py-1.5 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 placeholder:text-zinc-300"
                      />
                      <select
                        value={char.role}
                        onChange={(e) => updateCharacter(idx, 'role', e.target.value)}
                        className="w-20 px-2 py-1.5 border border-zinc-200 rounded text-sm outline-none text-zinc-700 bg-white"
                      >
                        <option value="主角">主角</option>
                        <option value="配角">配角</option>
                        <option value="反派">反派</option>
                        <option value="其他">其他</option>
                      </select>
                      {bookCharacters.length > 1 && (
                        <button
                          type="button" onClick={() => removeCharacter(idx)}
                          className="p-1 text-zinc-300 hover:text-zinc-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 印象分 */}
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">
                  印象分 <span className="text-red-400">*</span>
                  <span className="text-zinc-300 ml-1">（0 – 10）</span>
                </label>
                <input
                  type="number" value={impressedScore}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (e.target.value === '' || (value >= 0 && value <= 10)) {
                      setImpressedScore(e.target.value);
                    }
                  }}
                  min={0} max={10} step={0.1}
                  className="w-32 px-3 py-2 border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>
          </section>

          {/* 逐项核对 — 保持原版不变 */}
          <section>
            <p className="text-xs text-zinc-400 mb-4 pb-2 border-b border-zinc-100">逐项核对</p>
            <div className="divide-y divide-zinc-50">
              {PRINCIPLES.map((p, index) => {
                const currentAnswer = principleScores[p.id];
                const getLabelColor = (type: 'yes' | 'no') => {
                  if (currentAnswer !== type) return 'text-zinc-300';
                  if (p.reverseScore) {
                    return type === 'yes' ? 'text-green-600' : 'text-red-600';
                  }
                  return type === 'yes' ? 'text-red-600' : 'text-green-600';
                };
                return (
                  <div key={p.id} className="py-5 first:pt-0">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed text-zinc-700">
                          <span className="text-zinc-300 font-mono mr-2 text-xs">{(index + 1).toString().padStart(2, '0')}</span>
                          {p.text}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        {(['yes', 'no'] as const).map((type) => (
                          <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio" name={p.id}
                              checked={currentAnswer === type}
                              onChange={() => setPrincipleScores(prev => ({ ...prev, [p.id]: type }))}
                              className="w-4 h-4 accent-zinc-900"
                            />
                            <span className={`text-sm font-bold transition-colors ${getLabelColor(type)}`}>
                              {type === 'yes' ? '有' : '没有'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={principleRemarks[p.id] || ''}
                      onChange={(e) => setPrincipleRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="补充备注（选填）"
                      rows={1}
                      className="mt-2 w-full px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded text-xs text-zinc-600 outline-none focus:border-zinc-300 focus:bg-white transition-all placeholder:text-zinc-300 resize-y min-h-[28px]"
                      style={{ height: 'auto', minHeight: '28px' }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* 额外扣分 */}
          <section>
            <p className="text-xs text-zinc-400 mb-4 pb-2 border-b border-zinc-100">其他恶劣情节扣分</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-zinc-500">额外扣分</span>
              <input
                type="number" value={extraDeduction}
                onChange={(e) => setExtraDeduction(Number(e.target.value))}
                className="w-20 px-3 py-1.5 border border-zinc-200 rounded text-sm text-center outline-none focus:border-zinc-400 transition-colors"
              />
              <span className="text-sm text-zinc-400">分</span>
            </div>
            <textarea
              value={extraRemark}
              onChange={(e) => setExtraRemark(e.target.value)}
              placeholder="说明额外扣分原因..."
              className="w-full bg-zinc-50 rounded-lg px-3 py-2.5 h-24 text-sm outline-none border border-zinc-100 focus:border-zinc-300 focus:bg-white transition-all placeholder:text-zinc-300 resize-none"
            />
          </section>

          <div className="h-24" />
        </div>
      </div>

      {/* ── 底部吸底 ── */}
      <div className="px-4 py-3 border-t border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-zinc-400">最终评分</span>
          <span className="text-2xl font-bold text-zinc-900">{finalScore.toFixed(1)}</span>
          <span className="text-xs text-zinc-400">/ 10</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 border border-zinc-200 rounded hover:bg-zinc-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-zinc-900 text-white text-sm rounded hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            保存评分
          </button>
        </div>
      </div>
    </div>
  );
}
