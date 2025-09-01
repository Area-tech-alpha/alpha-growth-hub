import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    try {
        const lead = await prisma.leads.findUnique({ where: { id } })
        if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(lead)
    } catch (e: unknown) {
        return NextResponse.json({ error: 'Internal error', details: String(e) }, { status: 500 })
    }
}


