import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Save } from 'lucide-react';

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
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
  reviewer_comment: string;
}

// 评分原则（从 principle.py 转换）
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
  const [impressedScore, setImpressedScore] = useState(initialData?.impressed_score || 10);
  const [principleScores, setPrincipleScores] = useState<{ [key: string]: 'yes' | 'no' | null }>(
    initialData?.principle_scores || {}
  );
  const [principleRemarks, setPrincipleRemarks] = useState<{ [key: string]: string }>(
    initialData?.principle_remarks || {}
  );
  const [extraDeduction, setExtraDeduction] = useState(initialData?.extra_deduction || 0);
  const [extraRemark, setExtraRemark] = useState(initialData?.extra_remark || '');
  const [reviewerComment, setReviewerComment] = useState(initialData?.reviewer_comment || '');
  
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  // 计算最终得分
  const calculateFinalScore = () => {
    let deductions = 0;
    
    PRINCIPLES.forEach((principle) => {
      const answer = principleScores[principle.id];
      if (principle.reverseScore) {
        // p23-p25: "没有"需要扣分
        if (answer === 'no') deductions += 1;
      } else {
        // p1-p22: "有"需要扣分
        if (answer === 'yes') deductions += 1;
      }
    });
    
    return Math.max(0, impressedScore - deductions - extraDeduction);
  };

  const finalScore = calculateFinalScore();

  const handleSave = () => {
    if (!bookName.trim()) {
      showToast('请输入书名', 'error');
      return;
    }
    if (!bookAuthor.trim()) {
      showToast('请输入作者姓名', 'error');
      return;
    }

    const ratingData: BookRatingData = {
      book_name: bookName,
      book_author: bookAuthor,
      book_platform: bookPlatform,
      impressed_score: impressedScore,
      principle_scores: principleScores,
      principle_remarks: principleRemarks,
      extra_deduction: extraDeduction,
      extra_remark: extraRemark,
      final_score: finalScore,
      reviewer_comment: reviewerComment,
    };

    onSave(ratingData);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">女主无cp/无男主小说评分</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 评分规则说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <h3 className="font-bold mb-2">📋 评分规则</h3>
              <div className="space-y-1 text-zinc-700">
                <p><strong>1. 打分为减分制。</strong></p>
                <p>完结小说满分为10分，读者根据阅读后体验和感受，给一个印象得分，然后再根据组规进行减分。</p>
                <p>即最终得分 = 印象分 - 减分项，最终得分 ≤ 10分。【谨慎打8分以上，禁止分数膨胀】</p>
                <p><strong>2. 打分规则。</strong></p>
                <p>各项基础扣分分值为1分，情节严重的可以增加扣分分值，无上限。必须列出各项减分项存在与否。</p>
                <p className="text-red-600"><strong>❗❗❗注意：没有明确标注/提出的、不完全的、模棱两可的即需要扣分，请各位打分人严格执行！！</strong></p>
              </div>
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">书名 *</label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="请输入书名"
                  className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">作者姓名 *</label>
                <input
                  type="text"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="请输入作者姓名"
                  className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">平台</label>
                <input
                  type="text"
                  value={bookPlatform}
                  onChange={(e) => setBookPlatform(e.target.value)}
                  placeholder="如：晋江、长佩等"
                  className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">印象分 * (最高10分)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={impressedScore}
                  onChange={(e) => setImpressedScore(Number(e.target.value))}
                  className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            {/* 评分准则 */}
            <div>
              <h3 className="text-lg font-bold mb-4">评分准则 (共{PRINCIPLES.length}项)</h3>
              <div className="space-y-3">
                {PRINCIPLES.map((principle, index) => (
                  <div key={principle.id} className="border border-zinc-200 rounded-lg">
                    <button
                      onClick={() => toggleSection(principle.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 text-left">
                        <span className="font-bold text-sm text-zinc-500 flex-shrink-0">{index + 1}.</span>
                        <span className="text-sm">{principle.text}</span>
                      </div>
                      {expandedSections[principle.id] ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                      )}
                    </button>
                    
                    {expandedSections[principle.id] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-zinc-100">
                        <div className="flex gap-4 mt-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={principle.id}
                              checked={principleScores[principle.id] === 'yes'}
                              onChange={() => setPrincipleScores(prev => ({ ...prev, [principle.id]: 'yes' }))}
                              className="w-4 h-4 accent-black"
                            />
                            <span className="text-sm">有</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={principle.id}
                              checked={principleScores[principle.id] === 'no'}
                              onChange={() => setPrincipleScores(prev => ({ ...prev, [principle.id]: 'no' }))}
                              className="w-4 h-4 accent-black"
                            />
                            <span className="text-sm">没有</span>
                          </label>
                        </div>
                        <textarea
                          value={principleRemarks[principle.id] || ''}
                          onChange={(e) => setPrincipleRemarks(prev => ({ ...prev, [principle.id]: e.target.value }))}
                          placeholder="备注（可选）"
                          className="w-full p-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 额外扣分 */}
            <div>
              <label className="block text-sm font-bold mb-2">因为其它恶劣情节，我还想减分</label>
              <input
                type="number"
                min="0"
                max="10"
                value={extraDeduction}
                onChange={(e) => setExtraDeduction(Number(e.target.value))}
                className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
              <textarea
                value={extraRemark}
                onChange={(e) => setExtraRemark(e.target.value)}
                placeholder="额外扣分原因（可选）"
                className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none mt-2"
                rows={2}
              />
            </div>

            {/* 最终得分显示 */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
              <div className="text-center">
                <p className="text-sm text-zinc-600 mb-2">最终评分</p>
                <p className="text-5xl font-bold text-purple-600">{finalScore.toFixed(1)}</p>
                <p className="text-xs text-zinc-500 mt-2">
                  (印象分 {impressedScore} - 准则扣分 {impressedScore - finalScore - extraDeduction} - 额外扣分 {extraDeduction})
                </p>
              </div>
            </div>

            {/* 评价 */}
            <div>
              <label className="block text-sm font-bold mb-2">爱女姐有话说</label>
              <textarea
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="分享你的阅读感受..."
                className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存评分
          </button>
        </div>
      </div>
    </div>
  );
}
