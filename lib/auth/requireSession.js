import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth/options';

export async function requireSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return session;
}
