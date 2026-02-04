import React, { useState } from 'react';
import { X, Save, Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';

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
  reviewer_name: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
}

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

  // 严格控制分数输入
  const handleScoreChange = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      setImpressedScore('');
    } else {
      setImpressedScore(num > 10 ? 10 : num); // 强制不得超过10分
    }
  };

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

  const handleSave = () => {
    if (!bookName.trim() || !bookAuthor.trim()) return showToast('请完善书名和作者', 'error');
    onSave({
      book_name: bookName,
      book_author: bookAuthor,
      book_platform: bookPlatform,
      reviewer_name: reviewerName || '匿名发帖者',
      impressed_score: Number(impressedScore),
      principle_scores: principleScores,
      principle_remarks: principleRemarks,
      extra_deduction: extraDeduction,
      extra_remark: extraRemark,
      final_score: finalScore,
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden text-zinc-900 text-xl">
      {/* 头部 - 黑白灰风格 */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-zinc-100 bg-white">
        <div className="flex items-center gap-6">
          <h2 className="text-3xl font-black tracking-tighter">女主无cp/无男主小说评分</h2>
          <button 
            onClick={quickFillPerfect}
            className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900 text-white rounded hover:bg-zinc-700 text-sm font-bold transition-all shadow-sm"
          >
            <Zap className="w-4 h-4" /> 一键填选
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-10 h-10 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-12 space-y-20">
          
          {/* 评分规则 (折叠 & 原始文字) */}
          <section className="bg-zinc-50 border-y border-zinc-200">
            <button 
              onClick={() => setShowRules(!showRules)}
              className="w-full flex items-center justify-between p-6 hover:bg-zinc-100 transition-colors"
            >
              <div className="flex items-center gap-4 font-black text-lg text-zinc-600">
                <Info className="w-6 h-6" /> 📋 评分规则
              </div>
              {showRules ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
            {showRules && (
              <div className="px-8 pb-8 pt-2 text-lg text-zinc-700 leading-relaxed space-y-4">
                <p><strong>1. 打分为减分制。</strong></p>
                <p>完结小说满分为10分，读者根据阅读后体验和感受，给一个印象得分，然后再根据组规进行减分。</p>
                <p>即最终得分 = 印象分 - 减分项，最终得分 ≤ 10分。【谨慎打8分以上，禁止分数膨胀】</p>
                <p><strong>2. 打分规则。</strong></p>
                <p>各项基础扣分分值为1分，情节严重的可以增加扣分分值，无上限。必须列出各项减分项存在与否。</p>
                <p className="text-red-600 font-bold">❗❗❗注意：没有明确标注/提出的、不完全的、模棱两可的即需要扣分，请各位打分人严格执行！！</p>
              </div>
            )}
          </section>

          {/* 基本信息 - 无左右边框 */}
          <section>
            <h3 className="text-base font-black text-zinc-400 mb-10 flex items-center gap-4 tracking-[0.2em] uppercase">
              基本资料 <span className="h-px flex-1 bg-zinc-100"></span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-12">
              {[
                { label: '书名 *', val: bookName, set: setBookName },
                { label: '作者姓名 *', val: bookAuthor, set: setBookAuthor },
                { label: '打分人', val: reviewerName, set: setReviewerName, ph: '默认为发帖者' },
                { label: '阅读平台', val: bookPlatform, set: setBookPlatform, ph: '如：晋江' },
                { 
                  label: '初始印象分 (最大10) *', 
                  val: impressedScore, 
                  set: handleScoreChange, 
                  type: 'number' 
                },
              ].map((item, i) => (
                <div key={i} className="border-b-2 border-zinc-100 py-2 focus-within:border-zinc-900 transition-colors">
                  <label className="block text-xs font-black mb-3 text-zinc-400 uppercase tracking-widest">{item.label}</label>
                  <input
                    type={item.type || 'text'}
                    value={item.val}
                    max={item.type === 'number' ? 10 : undefined}
                    onChange={(e) => item.set(e.target.value)}
                    placeholder={item.ph || ''}
                    className="w-full bg-transparent outline-none text-2xl font-bold placeholder:text-zinc-200"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 准则核对 - 无左右边框，黑白灰配色 */}
          <section>
            <h3 className="text-base font-black text-zinc-400 mb-10 flex items-center gap-4 tracking-[0.2em] uppercase">
              逐项核对 <span className="h-px flex-1 bg-zinc-100"></span>
            </h3>
            <div className="divide-y divide-zinc-100">
              {PRINCIPLES.map((p, index) => {
                const currentAnswer = principleScores[p.id];
                const getLabelColor = (type: 'yes' | 'no') => {
                  if (currentAnswer !== type) return 'text-zinc-200';
                  // 后三项(p23-p25)是反向逻辑
                  if (p.reverseScore) {
                    return type === 'yes' ? 'text-green-600' : 'text-red-600';
                  }
                  return type === 'yes' ? 'text-red-600' : 'text-green-600';
                };

                return (
                  <div key={p.id} className="py-10 first:pt-0">
                    <div className="flex flex-col md:flex-row md:items-start gap-10">
                      <div className="flex-1">
                        <p className="text-xl leading-relaxed text-zinc-800 font-semibold">
                          <span className="text-zinc-300 font-mono mr-5 text-base italic">{(index + 1).toString().padStart(2, '0')}</span>
                          {p.text}
                        </p>
                      </div>
                      <div className="flex items-center gap-10 shrink-0 pt-1">
                        {(['yes', 'no'] as const).map((type) => (
                          <label key={type} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="radio"
                              name={p.id}
                              checked={currentAnswer === type}
                              onChange={() => setPrincipleScores(prev => ({ ...prev, [p.id]: type }))}
                              className="w-6 h-6 accent-zinc-900"
                            />
                            <span className={`text-xl font-black uppercase transition-colors ${getLabelColor(type)}`}>
                              {type === 'yes' ? '有' : '没有'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="mt-8">
                      <input
                        type="text"
                        value={principleRemarks[p.id] || ''}
                        onChange={(e) => setPrincipleRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="在此处输入该项的详细备注说明..."
                        className="w-full text-lg text-zinc-800 bg-zinc-50 px-6 py-4 rounded-lg border border-zinc-200 focus:border-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 额外扣分 - 极简黑白灰 */}
          <section className="pt-12 border-t border-zinc-100">
            <div className="max-w-2xl space-y-10">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-zinc-400 uppercase tracking-widest">其他恶劣情节减分</label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-500 font-bold">扣分分值:</span>
                  <input
                    type="number"
                    value={extraDeduction}
                    onChange={(e) => setExtraDeduction(Number(e.target.value))}
                    className="w-24 border-b-2 border-zinc-200 outline-none focus:border-zinc-900 text-center text-2xl font-black pb-1"
                  />
                </div>
              </div>
              <textarea
                value={extraRemark}
                onChange={(e) => setExtraRemark(e.target.value)}
                placeholder="详细说明额外扣分的原因..."
                className="w-full bg-zinc-50 rounded-xl p-6 h-40 text-xl outline-none border border-zinc-200 focus:border-zinc-900 focus:bg-white transition-all placeholder:text-zinc-300"
              />
            </div>
          </section>
          
          <div className="h-48" />
        </div>
      </div>

      {/* 底部吸底 - 极简白背景 */}
      <div className="px-12 py-10 border-t border-zinc-100 bg-white flex items-center justify-between shadow-2xl">
        <div className="flex items-baseline gap-6">
          <span className="text-sm font-black text-zinc-300 uppercase tracking-[0.4em]">最终评分</span>
          <span className="text-7xl font-black italic tracking-tighter text-zinc-900 leading-none">{finalScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-12">
          <button onClick={onClose} className="text-sm font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">取消</button>
          <button
            onClick={handleSave}
            className="w-24 h-24 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-black hover:scale-105 active:scale-95 transition-all shadow-xl"
            title="保存"
          >
            <Save className="w-10 h-10" />
          </button>
        </div>
      </div>
    </div>
  );
}
