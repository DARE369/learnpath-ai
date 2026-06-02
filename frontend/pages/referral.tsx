import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Gift, Share2, Copy, Check, Clock, TrendingUp, Mail, MessageSquare } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';

interface ReferralStats {
  referral_code: string;
  referral_url: string;
  share_text: string;
  total_referrals: number;
  successful_referrals: number;
  total_earnings: number;
  earnings_this_month: number;
  earnings_remaining_this_month: number;
  monthly_cap: number;
  referrals: Array<{
    id: string;
    status: string;
    signed_up_at?: string;
    reward_given: boolean;
    reward_amount: number;
  }>;
}

export default function ReferralPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch('/api/referral/stats', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.status === 401) { router.push('/auth/login'); return; }
      if (!response.ok) throw new Error('Failed to fetch referral stats');
      setStats(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading');
    } finally {
      setLoading(false);
    }
  }, [accessToken, router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCopyLink = () => {
    if (stats?.referral_url) {
      navigator.clipboard.writeText(stats.referral_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareViaEmail = () => {
    if (stats?.referral_url) {
      const subject = 'Join LearnPath AI - Get 500 Credit';
      const body = stats.share_text;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  };

  const handleShareViaWhatsApp = () => {
    if (stats?.referral_url) {
      const message = encodeURIComponent(stats.share_text);
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  if (loading) return <><Navbar /><div className="flex justify-center items-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></>;

  if (!stats) return <><Navbar /><div className="min-h-screen bg-gray-50 pt-20"><div className="max-w-3xl mx-auto px-4"><div className="text-yellow-700">No data available</div></div></div></>;

  return <>
    <Navbar />
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8"><div className="flex items-center gap-3 mb-2"><Gift className="w-8 h-8 text-blue-600" /><h1 className="text-3xl font-bold text-gray-900">Referral Program</h1></div></div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Referral Code</h2>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">Sharing code:</p>
            <p className="text-2xl font-mono font-bold text-blue-700">{stats.referral_code}</p>
          </div>
          <div className="flex gap-3"><button onClick={handleShareViaEmail} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg"><Mail className="w-4 h-4" />Email</button><button onClick={handleShareViaWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg"><MessageSquare className="w-4 h-4" />WhatsApp</button></div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" />Your Earnings</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-600 mb-1">Total Earned</p><p className="text-2xl font-bold">₦{stats.total_earnings.toLocaleString()}</p></div>
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-600 mb-1">This Month</p><p className="text-2xl font-bold text-green-600">₦{stats.earnings_this_month.toLocaleString()}</p></div>
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-600 mb-1">Remaining</p><p className="text-2xl font-bold text-blue-600">₦{stats.earnings_remaining_this_month.toLocaleString()}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Share2 className="w-5 h-5" />Referrals ({stats.total_referrals})</h2>
          {stats.total_referrals === 0 ? <p className="text-gray-600">No referrals yet</p> : <div className="space-y-2">{stats.referrals.slice(0, 5).map((ref, idx) => <div key={idx} className="flex items-center gap-2 pb-2 border-b"><Check className="w-4 h-4 text-green-600" /><span>Referral {idx + 1}</span><span className="ml-auto text-green-600">₦{ref.reward_amount}</span></div>)}</div>}
        </div>
      </div>
    </div>
  </>;
}
