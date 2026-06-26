import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log('[PATCH /api/members/:id] Called, id:', id)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const body = await request.json()
    const { full_name, phone, email } = body

    console.log('[EditMember] Updating:', { full_name, phone, email })

    if (!full_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    const { data: member, error } = await supabase
      .from('members')
      .update({
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single()

    if (error) {
      console.log('[EditMember] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[EditMember] Done ✅')
    return NextResponse.json({ member })

  } catch (err) {
    console.error('[EditMember] Unexpected:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
