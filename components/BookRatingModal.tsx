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
  reviewer_comment: string;
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
  const [reviewerComment, setReviewerComment] = useState(initialData?.reviewer_comment || '');

  // 控制注意事项的折叠
  const [showRules, setShowRules] = useState(true);

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
    showToast('已一键填选最优选项', 'info');
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
      reviewer_comment: reviewerComment,
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden text-zinc-900">
      {/* 头部 */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight">女主无cp/无男主小说评分</h2>
          <button 
            onClick={quickFillPerfect}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 rounded text-xs font-bold transition-colors text-zinc-600"
            title="一键神作"
          >
            <Zap className="w-3.5 h-3.5" /> 一键填选
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-12">
          
          {/* 评分规则 (带折叠) */}
          <section className="bg-zinc-50 rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowRules(!showRules)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-100/50 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-600">
                <Info className="w-4 h-4" /> 📋 评分规则说明
              </div>
              {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showRules && (
              <div className="px-5 pb-5 pt-2 text-sm text-zinc-600 leading-relaxed border-t border-zinc-200/50">
                <p>1. <strong>打分为减分制。</strong> 完结小说满分为10分，最终得分 = 印象分 - 减分项，最终得分 ≤ 10分。</p>
                <p className="mt-1">2. <strong>打分规则。</strong> 各项基础扣分分值为1分，情节严重可增加扣分，无上限。</p>
                <p className="mt-2 text-red-500 font-bold italic">❗❗❗ 注意：没有明确标注/提出的、不完全的、模棱两可的即需要扣分，请各位打分人严格执行！！</p>
              </div>
            )}
          </section>

          {/* 基本信息 (无外边框) */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <span className="w-4 h-px bg-zinc-200"></span> 基本信息
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
              {[
                { label: '书名 *', val: bookName, set: setBookName, ph: '书名' },
                { label: '作者姓名 *', val: bookAuthor, set: setBookAuthor, ph: '作者' },
                { label: '打分人', val: reviewerName, set: setReviewerName, ph: '不填默认发帖者' },
                { label: '平台', val: bookPlatform, set: setBookPlatform, ph: '如：晋江' },
                { label: '印象分 (0-10) *', val: impressedScore, set: setImpressedScore, type: 'number' },
              ].map((item, i) => (
                <div key={i}>
                  <label className="block text-xs font-bold mb-2 text-zinc-500">{item.label}</label>
                  <input
                    type={item.type || 'text'}
                    value={item.val}
                    onChange={(e) => item.set(item.type === 'number' ? e.target.value : e.target.value)}
                    placeholder={item.ph}
                    className="w-full pb-2 bg-transparent border-b border-zinc-200 focus:border-black outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 准则 (无外边框平铺) */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <span className="w-4 h-px bg-zinc-200"></span> 逐项核对
            </h3>
            <div className="space-y-6">
              {PRINCIPLES.map((p, index) => (
                <div key={p.id} className="group py-4 border-b border-zinc-50">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm leading-snug text-zinc-700">
                        <span className="text-zinc-300 font-mono mr-2">{(index + 1).toString().padStart(2, '0')}</span>
                        {p.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0">
                      {['yes', 'no'].map((type) => (
                        <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={p.id}
                            checked={principleScores[p.id] === type}
                            onChange={() => setPrincipleScores(prev => ({ ...prev, [p.id]: type as any }))}
                            className="w-3.5 h-3.5 accent-black"
                          />
                          <span className={`text-xs ${principleScores[p.id] === type ? 'font-bold text-black' : 'text-zinc-400'}`}>
                            {type === 'yes' ? '有' : '没有'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={principleRemarks[p.id] || ''}
                    onChange={(e) => setPrincipleRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="添加补充..."
                    className="mt-2 text-xs text-zinc-400 bg-transparent border-none outline-none w-full placeholder:text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 补充 */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
            <div className="space-y-4">
              <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest">额外扣分原因</label>
              <div className="flex gap-4 items-end mb-2">
                <span className="text-sm text-zinc-500 whitespace-nowrap">分值:</span>
                <input
                  type="number"
                  value={extraDeduction}
                  onChange={(e) => setExtraDeduction(Number(e.target.value))}
                  className="w-20 border-b border-zinc-200 outline-none focus:border-black pb-1 text-center"
                />
              </div>
              <textarea
                value={extraRemark}
                onChange={(e) => setExtraRemark(e.target.value)}
                placeholder="详细说明..."
                className="w-full bg-zinc-50 rounded-lg p-4 h-24 text-sm outline-none border border-transparent focus:bg-white focus:border-zinc-200 transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest">爱女姐有话说</label>
              <textarea
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="综合阅读感受..."
                className="w-full bg-zinc-50 rounded-lg p-4 h-[148px] text-sm outline-none border border-transparent focus:bg-white focus:border-zinc-200 transition-all"
              />
            </div>
          </section>
          <div className="h-20" />
        </div>
      </div>

      {/* 底部吸底 */}
      <div className="p-6 border-t border-zinc-100 bg-white/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black italic tracking-tighter">{finalScore.toFixed(1)}</span>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Final Score</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors">取消</button>
          <button
            onClick={handleSave}
            className="px-10 py-2.5 bg-black text-white rounded-full text-sm font-bold hover:shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> 保存评分报告
          </button>
        </div>
      </div>
    </div>
  );
}
