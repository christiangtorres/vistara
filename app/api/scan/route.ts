import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `You are reading a conference attendee badge from a photo. Extract these fields and return ONLY valid JSON (no prose, no markdown fences):
{
  "name": string,
  "company": string,
  "title": string,
  "email": string,
  "phone": string,
  "company_guess": string
}
Use empty strings for fields you can't read. company_guess is a 1-2 sentence guess at what the company does, based on the company name. Do not invent contact info — only company_guess may be inferred.`;

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('photo') as File | null;
  if (!file) return NextResponse.json({ error: 'no photo' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'image/jpeg';

  const ext = mime.split('/')[1] || 'jpg';
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const sb = supabaseAdmin();
  const up = await sb.storage.from('badges').upload(path, bytes, { contentType: mime });
  if (up.error) return NextResponse.json({ error: 'upload: ' + up.error.message }, { status: 500 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  let extracted: Record<string, string> = {};
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime as any, data: bytes.toString('base64') } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    const block = msg.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
    let text = (block?.text || '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(json)?|```$/gm, '').trim();
    extracted = JSON.parse(text);
  } catch (e: any) {
    return NextResponse.json({ photo_path: path, extracted: { error: e.message } });
  }

  return NextResponse.json({ photo_path: path, extracted });
}
