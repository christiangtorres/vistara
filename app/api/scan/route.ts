import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT_BADGE = `You are reading a conference attendee badge from a photo. Extract these fields and return ONLY valid JSON (no prose, no markdown fences):
{
  "name": string,
  "company": string,
  "email": string,
  "role": string,
  "company_guess": string
}
Use empty strings for fields you cannot read or guess.
- role: the badge category/type printed on the badge — e.g. "Attendee", "Sponsor", "Speaker", "Exhibitor", "Staff", "Press", "VIP". Copy exactly as shown.
- email: if an email is printed on the badge, use it exactly. Otherwise, guess the most likely email using the person's first name and a domain derived from THEIR EMPLOYER COMPANY (the company printed on the badge next to their name). Never use the conference name, event name, sponsor names, or any organization other than the person's own employer. Use the lowercase pattern "firstname@<domain>". Derive the domain from the employer company name (e.g. "Acme Robotics" → acmerobotics.com, "Big Sky Tech" → bigskytech.com). If you cannot identify the employer company, return an empty string.
- company_guess: 1-2 sentence guess at what the company does, based on the company name.
Do not invent the name or company. Only email and company_guess may be inferred.`;

const PROMPT_CARD = `You are reading a business card from a photo. Extract these fields and return ONLY valid JSON (no prose, no markdown fences):
{
  "name": string,
  "company": string,
  "email": string,
  "company_guess": string
}
Use empty strings for fields you cannot read or guess. The card may include a title, phone, address — ignore those.
- email: if an email is printed on the card, use it exactly. Otherwise, guess the most likely email using the person's name and the domain from any website on the card (or derived from the company name). Use the lowercase pattern "firstname@<domain>" (first name only, no last name). If you cannot reasonably guess a domain, return an empty string.
- company_guess: 1-2 sentence guess at what the company does, based on the company name, any tagline, and the website domain.
Do not invent the name or company. Only email and company_guess may be inferred.`;

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('photo') as File | null;
  const kind = (form.get('kind') as string) === 'card' ? 'card' : 'badge';
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
  let rawText = '';
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime as any, data: bytes.toString('base64') } },
          { type: 'text', text: kind === 'card' ? PROMPT_CARD : PROMPT_BADGE },
        ],
      }],
    });
    const block = msg.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
    rawText = (block?.text || '').trim();
    // Strip code fences, then find the first {...} block in case there's prose around it
    let text = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
    extracted = JSON.parse(text);
  } catch (e: any) {
    console.error('scan extract failed', e, 'raw:', rawText);
    return NextResponse.json({ photo_path: path, extracted: { error: e.message, raw: rawText.slice(0, 500) } });
  }

  return NextResponse.json({ photo_path: path, extracted });
}
