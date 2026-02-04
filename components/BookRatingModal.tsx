import React, { useState } from 'react';
import { X, Save, Star, Zap } from 'lucide-react';

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
  reviewer_name: string; // 新增：打分人
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

  // 计算最终得分
  const calculateFinalScore = () => {
    let deductions = 0;
    const baseScore = Number(impressedScore) || 0;
    
    PRINCIPLES.forEach((principle) => {
      const answer = principleScores[principle.id];
      if (principle.reverseScore) {
        if (answer === 'no') deductions += 1;
      } else {
        if (answer === 'yes') deductions += 1;
      }
    });
    
    return Math.max(0, baseScore - deductions - extraDeduction);
  };

  const finalScore = calculateFinalScore();

  // 一键满分功能
  const quickFillPerfect = () => {
    const perfectScores: { [key: string]: 'yes' | 'no' } = {};
    PRINCIPLES.forEach(p => {
      perfectScores[p.id] = p.reverseScore ? 'yes' : 'no';
    });
    setPrincipleScores(perfectScores);
    setImpressedScore(10);
    setExtraDeduction(0);
    showToast('已自动填选：前22项为“没有”，后3项为“有”', 'info');
  };

  const handleSave = () => {
    if (!bookName.trim()) return showToast('请输入书名', 'error');
    if (!bookAuthor.trim()) return showToast('请输入作者姓名', 'error');

    const ratingData: BookRatingData = {
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
    };

    onSave(ratingData);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      {/* 头部固定 */}
      <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star className="text-yellow-400 fill-yellow-400" /> 女主小说严选评分
          </h2>
          <button 
            onClick={quickFillPerfect}
            className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold transition-all"
          >
            <Zap className="w-4 h-4" /> 一键神作
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* 内容滚动区 */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="max-w-5xl mx-auto p-6 space-y-8">
          
          {/* 规则卡片 */}
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg shadow-sm">
            <p className="text-sm text-amber-900 font-medium">
              ❗ 减分制：最终得分 = 印象分 - 准则扣分 - 额外扣分。请严格执行，避免分数膨胀。
            </p>
          </div>

          {/* 基本信息段落 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h3 className="text-lg font-bold mb-6 pb-2 border-b">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">书名 *</label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">作者姓名 *</label>
                <input
                  type="text"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">打分人 (非必填)</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="默认: 发帖者"
                  className="w-full p-3 bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">阅读平台</label>
                <input
                  type="text"
                  value={bookPlatform}
                  onChange={(e) => setBookPlatform(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">初始印象分 (0-10)</label>
                <input
                  type="number"
                  step="0.1"
                  value={impressedScore}
                  onChange={(e) => setImpressedScore(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-300 rounded-lg font-bold text-blue-600 focus:ring-2 focus:ring-black outline-none"
                />
              </div>
            </div>
          </section>

          {/* 准则平铺段落 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h3 className="text-lg font-bold mb-6 pb-2 border-b">详细准则 (逐项核对)</h3>
            <div className="space-y-4">
              {PRINCIPLES.map((principle, index) => (
                <div key={principle.id} className="p-4 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-800">
                        <span className="text-zinc-400 mr-2">{index + 1}.</span>
                        {principle.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 bg-white p-2 rounded-md border border-zinc-200 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name={principle.id}
                          checked={principleScores[principle.id] === 'yes'}
                          onChange={() => setPrincipleScores(prev => ({ ...prev, [principle.id]: 'yes' }))}
                          className="w-4 h-4 accent-red-600"
                        />
                        <span className={`text-sm ${principleScores[principle.id] === 'yes' ? 'font-bold' : ''}`}>有</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name={principle.id}
                          checked={principleScores[principle.id] === 'no'}
                          onChange={() => setPrincipleScores(prev => ({ ...prev, [principle.id]: 'no' }))}
                          className="w-4 h-4 accent-green-600"
                        />
                        <span className={`text-sm ${principleScores[principle.id] === 'no' ? 'font-bold' : ''}`}>没有</span>
                      </label>
                    </div>
                  </div>
                  {/* 备注输入框，直接显示 */}
                  <input
                    type="text"
                    value={principleRemarks[principle.id] || ''}
                    onChange={(e) => setPrincipleRemarks(prev => ({ ...prev, [principle.id]: e.target.value }))}
                    placeholder="针对此项的补充说明（可选）"
                    className="w-full mt-3 p-2 text-xs bg-transparent border-b border-zinc-200 focus:border-black outline-none"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 补充评价 */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">额外扣分项</h3>
              <input
                type="number"
                value={extraDeduction}
                onChange={(e) => setExtraDeduction(Number(e.target.value))}
                className="w-full p-3 border border-zinc-300 rounded-lg mb-3"
                placeholder="扣分分值"
              />
              <textarea
                value={extraRemark}
                onChange={(e) => setExtraRemark(e.target.value)}
                placeholder="请说明额外扣分原因..."
                className="w-full p-3 border border-zinc-300 rounded-lg h-24 resize-none"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">综合评价</h3>
              <textarea
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="写下你对本书的总体评价、推荐理由或避雷建议..."
                className="w-full p-3 border border-zinc-300 rounded-lg h-[164px] resize-none"
              />
            </div>
          </section>

          {/* 底部留空，防止被固定条遮挡 */}
          <div className="h-24"></div>
        </div>
      </div>

      {/* 底部计算与保存栏 */}
      <div className="bg-white border-t border-zinc-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-8">
          <div className="text-center md:text-left">
            <span className="text-xs text-zinc-500 block">最终得分</span>
            <span className="text-4xl font-black text-purple-700">{finalScore.toFixed(1)}</span>
          </div>
          <div className="text-xs text-zinc-400 leading-relaxed border-l pl-6">
            计算逻辑：<br />
            印象分({impressedScore}) - 准则项({(Number(impressedScore) - finalScore - extraDeduction).toFixed(1)}) - 额外({extraDeduction})
          </div>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <button
            onClick={onClose}
            className="flex-1 md:flex-none px-8 py-3 border border-zinc-300 rounded-xl hover:bg-zinc-50 font-medium"
          >
            退出
          </button>
          <button
            onClick={handleSave}
            className="flex-1 md:flex-none px-12 py-3 bg-black text-white rounded-xl hover:bg-zinc-800 font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            <Save className="w-5 h-5" />
            发布评分
          </button>
        </div>
      </div>
    </div>
  );
}
