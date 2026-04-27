import React, { useState } from 'react';
import { X, Save, Zap, Info, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookRatingModalProps {
  onClose: () => void;
  onSave: (ratingData: BookRatingData) => void;
  showToast: (msg: string, type: ToastType) => void;
  initialData?: BookRatingData;
}

// 对应 Supabase 新表结构的接口
export interface BookRatingData {
  book_name: string;
  book_author: string;
  book_platform: string;
  book_category: string;
  book_status: string; // 新增：连载状态
  book_link: string;   // 新增：推荐/排雷链接
  book_intro: string;  // 新增：书籍简介
  book_characters: { name: string, role: string }[]; // 新增：人物介绍
  reviewer_name: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
}

const BOOK_CATEGORIES = ['热血竞技','西幻史诗', '姼想奇幻', '科幻未来','恐怖灵异','无限快穿','性别战争','年代重制','悬疑推理', '东方架空', '校园青春', '职场商战', '武侠仙侠', '其他'];
const STATUS_OPTIONS = ['连载中', '已完结', '已断更', '已存稿'];

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
  const [bookStatus, setBookStatus] = useState(initialData?.book_status || '连载中');
  const [bookLink, setBookLink] = useState(initialData?.book_link || '');
  const [bookIntro, setBookIntro] = useState(initialData?.book_intro || '');
  const [characters, setCharacters] = useState(initialData?.book_characters || [{ name: '', role: '女主' }]);
  
  const [reviewerName, setReviewerName] = useState(initialData?.reviewer_name || '');
  const [impressedScore, setImpressedScore] = useState<number | string>(initialData?.impressed_score ?? 10);
  const [principleScores, setPrincipleScores] = useState(initialData?.principle_scores || {});
  const [principleRemarks, setPrincipleRemarks] = useState(initialData?.principle_remarks || {});
  const [extraDeduction, setExtraDeduction] = useState(initialData?.extra_deduction || 0);
  const [extraRemark, setExtraRemark] = useState(initialData?.extra_remark || '');
  const [showRules, setShowRules] = useState(false);

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

  const addCharacter = () => setCharacters([...characters, { name: '', role: '女配' }]);
  const removeCharacter = (index: number) => setCharacters(characters.filter((_, i) => i !== index));

  const handleSave = () => {
    if (!bookName.trim() || !bookAuthor.trim()) return showToast('请完善书名和作者', 'error');
    onSave({
      book_name: bookName,
      book_author: bookAuthor,
      book_platform: bookPlatform,
      book_category: bookCategory,
      book_status: bookStatus,
      book_link: bookLink,
      book_intro: bookIntro,
      book_characters: characters.filter(c => c.name),
      reviewer_name: reviewerName || '匿名',
      impressed_score: Number(impressedScore),
      principle_scores: principleScores,
      principle_remarks: principleRemarks,
      extra_deduction: extraDeduction,
      extra_remark: extraRemark,
      final_score: finalScore,
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden text-zinc-900">
      {/* 顶栏保持原样 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold italic">{finalScore.toFixed(1)}</span>
          <button onClick={() => {
             const perfect: any = {};
             PRINCIPLES.forEach(p => perfect[p.id] = p.reverseScore ? 'yes' : 'no');
             setPrincipleScores(perfect);
             setImpressedScore(10);
          }} className="ml-4 px-3 py-1 bg-zinc-900 text-white text-xs rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3 fill-current" /> 一键合规
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          
          {/* 1. 书籍基础信息卡片 */}
          <section className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 border-b border-zinc-50 pb-2">核心档案</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <input value={bookName} onChange={e => setBookName(e.target.value)} placeholder="书名 *" className="w-full text-lg font-bold outline-none border-b border-transparent focus:border-zinc-200 py-1" />
              </div>
              <input value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} placeholder="作者 *" className="text-sm outline-none border-b border-zinc-100 py-1" />
              <select value={bookStatus} onChange={e => setBookStatus(e.target.value)} className="text-sm outline-none border-b border-zinc-100 py-1 bg-transparent">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={bookPlatform} onChange={e => setBookPlatform(e.target.value)} placeholder="发布平台" className="text-sm outline-none border-b border-zinc-100 py-1" />
              <select value={bookCategory} onChange={e => setBookCategory(e.target.value)} className="text-sm outline-none border-b border-zinc-100 py-1 bg-transparent">
                <option value="">选择分类</option>
                {BOOK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </section>

          {/* 2. 简介与链接 (对应图片详情页) */}
          <section className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 border-b border-zinc-50 pb-2">内容详情</h2>
            <input value={bookLink} onChange={e => setBookLink(e.target.value)} placeholder="🔗 推荐/排雷贴链接 (选填)" className="w-full p-3 bg-zinc-50 rounded-xl text-xs outline-none" />
            <textarea value={bookIntro} onChange={e => setBookIntro(e.target.value)} placeholder="输入书籍简介..." className="w-full p-3 bg-zinc-50 rounded-xl text-sm h-24 outline-none resize-none" />
          </section>

          {/* 3. 人物介绍 (对应图片详情页) */}
          <section className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-zinc-400">主要人物</h2>
              <button onClick={addCharacter} className="text-xs text-zinc-500 flex items-center gap-1"><Plus className="w-3 h-3" /> 添加</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characters.map((char, index) => (
                <div key={index} className="flex gap-2 p-3 bg-zinc-50 rounded-xl relative group">
                  <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center text-zinc-400 text-xs">头像</div>
                  <div className="flex-1">
                    <input value={char.name} onChange={e => {
                      const newChars = [...characters];
                      newChars[index].name = e.target.value;
                      setCharacters(newChars);
                    }} placeholder="角色名" className="w-full bg-transparent text-sm font-bold outline-none" />
                    <input value={char.role} onChange={e => {
                      const newChars = [...characters];
                      newChars[index].role = e.target.value;
                      setCharacters(newChars);
                    }} placeholder="身份(如:女主)" className="w-full bg-transparent text-[10px] text-zinc-500 outline-none" />
                  </div>
                  {index > 0 && <button onClick={() => removeCharacter(index)} className="absolute right-2 top-2 text-zinc-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                </div>
              ))}
            </div>
          </section>

          {/* 4. 评分明细 (复用你原来的逻辑，但样式精简化) */}
          <section className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-400">准则核对</h2>
                <input type="number" value={impressedScore} onChange={e => setImpressedScore(e.target.value)} className="w-16 text-right font-bold outline-none border-b border-zinc-200" />
             </div>
             
             <div className="space-y-4 divide-y divide-zinc-50">
               {PRINCIPLES.map((p) => (
                 <div key={p.id} className="pt-4 first:pt-0">
                    <p className="text-xs text-zinc-700 leading-relaxed mb-2">{p.text}</p>
                    <div className="flex items-center gap-4">
                       {['yes', 'no'].map(type => (
                         <button key={type} onClick={() => setPrincipleScores({...principleScores, [p.id]: type})} 
                            className={`px-4 py-1 rounded-full text-[10px] transition-all border ${
                              principleScores[p.id] === type ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-100'
                            }`}>
                           {type === 'yes' ? '有此项' : '无此项'}
                         </button>
                       ))}
                       <input 
                         value={principleRemarks[p.id] || ''} 
                         onChange={e => setPrincipleRemarks({...principleRemarks, [p.id]: e.target.value})}
                         placeholder="备注内容..." 
                         className="flex-1 bg-zinc-50 px-3 py-1 rounded text-[10px] outline-none border border-transparent focus:border-zinc-200" 
                       />
                    </div>
                 </div>
               ))}
             </div>
          </section>

          <div className="h-20" />
        </div>
      </div>

      {/* 底部保存 */}
      <div className="p-4 bg-white border-t border-zinc-100 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-500">取消</button>
        <button onClick={handleSave} className="flex-[2] py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-zinc-200 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> 发布到书架
        </button>
      </div>
    </div>
  );
}
