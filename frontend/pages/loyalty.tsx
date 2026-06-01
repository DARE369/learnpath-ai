import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Award, Zap, Check, TrendingUp, Gift } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface LoyaltyStatus {
  total_points: number;
  lifetime_points: number;
  current_tier: string;
  tier_name: string;
  bonus_multiplier: number;
  next_tier: string | null;
  points_to_next_tier: number | null;
  tier_benefits: Record<string, any>;
  available_rewards: Array<{
    points_cost: number;
    reward_type: string;
    label: string;
    can_redeem: boolean;
  }>;
  all_tiers: Record<string, any>;
  history: Array<any>;
}

export default function LoyaltyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/loyalty/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.status === 401) { router.push('/login'); return; }
      if (!response.ok) throw new Error('Failed to fetch loyalty status');
      setStatus(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (pointsCost: number, rewardType: string) => {
    try {
      const response = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ points_amount: pointsCost, reward_type: rewardType })
      });
      if (response.ok) {
        fetchStatus();
        alert('Reward redeemed successfully');
      } else {
        alert('Failed to redeem reward');
      }
    } catch (err) {
      alert('Error redeeming reward');
    }
  };

  if (loading) return <><Navbar /><div className="flex justify-center items-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></>;

  if (!status) return <><Navbar /><div className="min-h-screen bg-gray-50 pt-20"><div className="max-w-3xl mx-auto px-4"><div className="text-yellow-700">No data</div></div></div></>;

  const tierProgress = status.points_to_next_tier ? Math.round(((status.lifetime_points - (status.all_tiers[status.current_tier]?.min_points || 0)) / status.points_to_next_tier) * 100) : 100;

  return <>
    <Navbar />
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8"><div className="flex items-center gap-3 mb-2"><Award className="w-8 h-8 text-purple-600" /><h1 className="text-3xl font-bold text-gray-900">Loyalty Program</h1></div></div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-600" />Your Points</h2>
          <div className="mb-4">
            <div className="text-4xl font-bold text-gray-900 mb-2">{status.total_points}</div>
            <p className="text-gray-600 text-sm">Spendable Points | Lifetime: {status.lifetime_points}</p>
          </div>
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between mb-2"><p className="text-sm font-medium">Current Tier</p><p className="text-sm font-bold text-purple-600">{status.tier_name}</p></div>
            <div className="w-full bg-gray-300 rounded-full h-2"><div className="bg-purple-600 h-full rounded-full" style={{width: `${tierProgress}%`}}></div></div>
            {status.points_to_next_tier && <p className="text-xs text-gray-600 mt-2">{status.points_to_next_tier} points to {status.next_tier}</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Check className="w-5 h-5 text-green-600" />Tier Benefits</h2>
          <div className="space-y-3">
            {Object.entries(status.all_tiers).map(([key, tier]: [string, any]) => (
              <div key={key} className={`p-4 rounded-lg border-2 ${key === status.current_tier ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 capitalize">{key}</h3>
                  {key === status.current_tier && <span className="text-xs font-bold text-purple-600">You</span>}
                </div>
                <p className="text-sm text-gray-600">{tier.multiplier}x multiplier {tier.achieved && '✓'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Gift className="w-5 h-5 text-blue-600" />Redeem Rewards</h2>
          <div className="space-y-3">
            {status.available_rewards.map((reward, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{reward.label}</p>
                  <p className="text-sm text-gray-600">{reward.points_cost} points</p>
                </div>
                <button
                  onClick={() => handleRedeem(reward.points_cost, reward.reward_type)}
                  disabled={!reward.can_redeem}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${reward.can_redeem ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500'}`}
                >
                  Redeem
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" />Recent Activity</h2>
          {status.history.length === 0 ? <p className="text-gray-600">No activity yet</p> : <div className="space-y-2">{status.history.slice(0, 5).map((item: any, idx: number) => <div key={idx} className="flex items-center justify-between pb-2 border-b text-sm"><span className="text-gray-600">{item.action}</span><span className={item.points > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{item.points > 0 ? '+' : ''}{item.points}</span></div>)}</div>}
        </div>
      </div>
    </div>
  </>;
}
