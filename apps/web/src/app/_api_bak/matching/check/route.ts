import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 매칭 체크 API
 * 특정 사용자의 saju_profile을 기존 ideal_saju_profiles와 대조하여
 * 매칭 후보를 찾아 matches 테이블에 삽입한다.
 *
 * POST body: { userId: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // service role key로 RLS 우회하여 전체 테이블 접근
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. 현재 사용자의 사주 프로필 조회
  const { data: mySaju, error: sajuError } = await supabase
    .from('saju_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (sajuError || !mySaju) {
    return NextResponse.json({ error: '사주 프로필이 없습니다' }, { status: 404 });
  }

  // 2. 다른 사용자들의 ideal_saju_profiles에서 내 일주(day_stem + day_branch)와 일치하는 것 찾기
  const { data: matchingIdeals } = await supabase
    .from('ideal_saju_profiles')
    .select('*')
    .eq('target_day_stem', mySaju.day_stem)
    .eq('target_day_branch', mySaju.day_branch)
    .eq('is_matched', false)
    .neq('user_id', userId);

  if (!matchingIdeals || matchingIdeals.length === 0) {
    return NextResponse.json({ matches: [], message: '현재 매칭 대상이 없습니다' });
  }

  // 3. 내 ideal_saju_profiles도 조회 (쌍방 매칭 확인)
  const { data: myIdeals } = await supabase
    .from('ideal_saju_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_matched', false);

  const newMatches = [];

  for (const ideal of matchingIdeals) {
    const otherUserId = ideal.user_id;

    // 이미 매칭된 쌍인지 확인
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`
      )
      .limit(1);

    if (existingMatch && existingMatch.length > 0) continue;

    // 상대방의 사주 프로필 조회
    const { data: otherSaju } = await supabase
      .from('saju_profiles')
      .select('*')
      .eq('user_id', otherUserId)
      .single();

    if (!otherSaju) continue;

    // 내 ideal에 상대 일주가 있는지 확인 (쌍방 매칭)
    const myMatchingIdeal = myIdeals?.find(
      (mi) =>
        mi.target_day_stem === otherSaju.day_stem &&
        mi.target_day_branch === otherSaju.day_branch
    );

    // 궁합 점수 (상대의 ideal 점수 사용, 쌍방이면 평균)
    let compatScore = ideal.compatibility_score || 50;
    if (myMatchingIdeal) {
      compatScore = Math.round(
        ((ideal.compatibility_score || 50) + (myMatchingIdeal.compatibility_score || 50)) / 2
      );
    }

    // 매칭 생성
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const { data: newMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        user_a_id: userId,
        user_b_id: otherUserId,
        ideal_profile_a_id: myMatchingIdeal?.id || null,
        ideal_profile_b_id: ideal.id,
        compatibility_score: compatScore,
        status: 'notified',
        user_a_decision: 'pending',
        user_b_decision: 'pending',
        notified_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (!matchError && newMatch) {
      // ideal profile을 매칭됨으로 표시
      await supabase
        .from('ideal_saju_profiles')
        .update({ is_matched: true, matched_user_id: userId })
        .eq('id', ideal.id);

      if (myMatchingIdeal) {
        await supabase
          .from('ideal_saju_profiles')
          .update({ is_matched: true, matched_user_id: otherUserId })
          .eq('id', myMatchingIdeal.id);
      }

      newMatches.push(newMatch);
    }
  }

  return NextResponse.json({
    matches: newMatches,
    message: `${newMatches.length}개의 새로운 매칭이 생성되었습니다`,
  });
}
