import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const updates = await request.json();

    // Validate the updates array structure
    if (!Array.isArray(updates)) {
      return new NextResponse('Invalid request format', { status: 400 });
    }

    // Begin transaction
    const { data: client } = await supabase.from('prices').select('id, price')
      .in('id', updates.map(u => u.priceId));

    // Process each update
    for (const update of updates) {
      const currentPrice = client?.find(p => p.id === update.priceId);
      
      // Insert new price record
      const { error: updateError } = await supabase.from('prices')
        .update({ 
          price: update.price,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.priceId);

      if (updateError) throw updateError;

      // Log the price change
      if (currentPrice) {
        const { error: logError } = await supabase.from('price_change_logs')
          .insert({
            price_id: update.priceId,
            old_price: currentPrice.price,
            new_price: update.price,
            changed_by: user.id
          });

        if (logError) throw logError;
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully updated ${updates.length} prices`
    });
  } catch (error) {
    console.error('Error processing bulk update:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}