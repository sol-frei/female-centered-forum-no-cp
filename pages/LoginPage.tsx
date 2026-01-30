import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords } from './types';
import { get_all_users, get_user, create_post, get_posts, toggle_like_post, toggle_essence_post, delete_post, vote_poll, add_comment, update_post, getComments, updateUser, getUnreadNotificationCount, create_collection, addToCollection, updatePost, update_comment, toggle_lock_post, delete_comment,check_sensitive_words } from './services/storage';
import AdminPanel from './components/AdminPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import { uploadImage } from './services/storageService';  // ✅ 新增这行
import { Search, LogOut, Menu, UserCircle, PenSquare, Heart, MessageCircle, MessageSquare, Trash2, X, Plus, Check, Star, Eye, EyeOff, Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical } from 'lucide-react';
import PostContent from './components/PostContent';

//Login组件


const Login = ({ onLogin }: { onLogin: (u: any) => void }) => {
  const [loginIdInput, setLoginIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = async () => {
    setError('');
    if (!loginIdInput || !password) {
      setError('请输入 ID 和密码');
      return;
    }

    try {
      setLoading(true);

      // --- 情况 A：管理员账号登录 ---
      if (loginIdInput.toLowerCase() === 'admin') {
        if (password === ADMIN_PASSWORD) {
          const { data, error: adminErr } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminErr || !data) {
            setError('管理员账号尚未在数据库中初始化');
            return;
          }
          onLogin(data);
          return;
        } else {
          setError('管理员密码错误');
          return;
        }
      }

      // --- 情况 B：普通用户登录（使用 Supabase Auth）---
      
      // 1. 先从数据库查询用户信息（通过 login_id 获取 email）
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginIdInput)
        .single();

      if (queryError || !userData) {
        setError('账号不存在，请检查 ID 是否输入正确');
        return;
      }

      if (userData.is_banned) {
        setError('该账号已被封禁，无法登录');
        return;
      }

      // 2. 使用 Supabase Auth 登录（创建 session）
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (authError) {
        console.error('登录失败:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError('密码错误');
        } else {
          setError('登录失败: ' + authError.message);
        }
        return;
      }

      console.log('✅ 登录成功, Session 已创建:', authData.session);
      console.log('✅ 用户信息:', authData.user);

      // 3. 登录成功，传递完整的用户信息
      onLogin({
        ...userData,
        auth_id: authData.user.id, // Supabase Auth 的 ID
      });

    } catch (e: any) {
      console.error('系统错误:', e);
      setError(`系统错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tighter">登录小组</h2>
          <p className="mt-2 text-zinc-500 text-sm">请输入管理员分发的 6 位短 ID 和密码</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">用户 ID</label>
            <input
              value={loginIdInput}
              onChange={e => setLoginIdInput(e.target.value)}
              disabled={loading}
              className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white font-mono disabled:opacity-50"
              placeholder="例如: AX79P2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">密码</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white pr-12 font-mono disabled:opacity-50"
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                disabled={loading}
                className="absolute right-4 top-4 text-zinc-400 hover:text-black disabled:opacity-50"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <X className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white py-4 font-bold text-lg hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-lg shadow-zinc-200 disabled:bg-zinc-400 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '确认登录'}
        </button>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-zinc-400">
            ID 是唯一的通行证，请妥善保管
          </p>
          <p className="text-[10px] text-zinc-300">
            Supabase Cloud Backend Connected
          </p>
        </div>
      </div>
    </div>
  );
};

