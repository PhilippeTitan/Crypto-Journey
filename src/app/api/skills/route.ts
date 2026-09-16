/**
 * MaurEdge 3.0 — Skills API
 * 
 * Serves the skill library and execution results to the UI.
 * Shows what the agent's named behaviors are and their performance.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const skills = require('@/../../core/skills/executor');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const memory = require('@/../../core/memory/store');

/**
 * GET /api/skills — returns skill library + stats
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const skillId = url.searchParams.get('id');

    if (skillId) {
      const skill = skills.getSkill(skillId);
      if (!skill) {
        return NextResponse.json({
          success: false,
          error: `Unknown skill: ${skillId}`,
        }, { status: 404 });
      }

      const stats = memory.getSkillStats(skillId);
      return NextResponse.json({
        success: true,
        skill,
        stats,
      });
    }

    const library = skills.getSkillLibrarySnapshot();
    return NextResponse.json({
      success: true,
      ...library,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
