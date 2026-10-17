import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, CloudConversation } from './types';

export async function fetchProjects(supabase: SupabaseClient): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch projects from Supabase:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error fetching projects:', err);
    return [];
  }
}

export async function createProject(
  supabase: SupabaseClient,
  name: string,
  description?: string,
  color?: string,
  customPrompt?: string,
): Promise<Project | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    let insertPayload: Record<string, unknown> = {
      user_id: userData.user.id,
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6366f1',
      custom_prompt: customPrompt?.trim() || '',
    };

    let { data, error } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select()
      .single();

    // If custom_prompt column does not exist yet in Supabase schema cache, retry without it
    if (error && (error.code === 'PGRST204' || error.message?.includes('custom_prompt'))) {
      console.warn("Retrying project creation without 'custom_prompt' column (run SQL migration to persist prompt to Supabase).");
      delete insertPayload.custom_prompt;
      const retryResult = await supabase
        .from('projects')
        .insert(insertPayload)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
      if (data && customPrompt) {
        data.custom_prompt = customPrompt.trim();
      }
    }

    if (error) {
      console.error('Failed to create project in Supabase:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error creating project:', err);
    return null;
  }
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  updates: { name?: string; description?: string; color?: string; custom_prompt?: string },
): Promise<boolean> {
  try {
    let { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);

    // If custom_prompt column does not exist in Supabase schema, retry without it
    if (error && (error.code === 'PGRST204' || error.message?.includes('custom_prompt'))) {
      console.warn("Retrying project update without 'custom_prompt' column.");
      const { custom_prompt, ...withoutPrompt } = updates;
      const retry = await supabase
        .from('projects')
        .update(withoutPrompt)
        .eq('id', projectId);
      error = retry.error;
    }

    if (error) {
      console.error('Failed to update project:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error updating project:', err);
    return false;
  }
}

export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Failed to delete project:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting project:', err);
    return false;
  }
}

export async function fetchCloudConversations(
  supabase: SupabaseClient,
  projectId?: string | null,
): Promise<CloudConversation[]> {
  try {
    let query = supabase.from('conversations').select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch conversations from Supabase:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return [];
  }
}

export async function saveCloudConversation(
  supabase: SupabaseClient,
  conversation: { id: string; title: string; messages: any[]; updatedAt: number },
  projectId?: string | null,
): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    // Sanitize messages to avoid payload limits
    const sanitizedMessages = (conversation.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      parts: Array.isArray(m.parts)
        ? m.parts.map((p: any) =>
            p.type === 'file'
              ? { type: 'file', mimeType: p.mimeType, name: p.name || 'attachment' }
              : p,
          )
        : undefined,
    }));

    const { error } = await supabase.from('conversations').upsert(
      {
        id: conversation.id,
        user_id: userData.user.id,
        project_id: projectId || null,
        title: conversation.title,
        messages: sanitizedMessages,
        updated_at: conversation.updatedAt || Date.now(),
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.error('Failed to save conversation to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving conversation:', err);
    return false;
  }
}

export async function deleteCloudConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting conversation:', err);
    return false;
  }
}
