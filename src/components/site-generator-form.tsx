'use client';

import React, { useEffect, useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Check, Sparkles } from 'lucide-react';
import { enhancePromptAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import Image from 'next/image';

function SubmitButton({ isPending, isAuthed, onRequireAuth }: { isPending: boolean; isAuthed: boolean; onRequireAuth?: () => void }) {
  return (
    <Button
      type={isAuthed ? "submit" : "button"}
      onClick={!isAuthed ? onRequireAuth : undefined}
      disabled={isPending}
      className={cn(
        "w-full text-lg py-6 font-headline text-white shadow-[0_20px_45px_rgba(90,50,255,0.35)] bg-gradient-to-r from-[#7f5af0]/80 via-[#5a31f0]/75 to-[#050109]/90 transition hover:brightness-110",
        isPending ? "opacity-90" : ""
      )}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-5 w-5" />
          Generate Website
        </>
      )}
    </Button>
  );
}

type EnhanceState = {
  success: boolean;
  error: string;
  enhancedPrompt: string;
};

const initialEnhanceState: EnhanceState = {
  success: false,
  error: '',
  enhancedPrompt: '',
};

export function SiteGeneratorForm({ formAction, isPending, state, modelName, onStartGenerating, isAuthed = true, onRequireAuth }: { formAction: (payload: FormData) => void, isPending: boolean, state: any, modelName: string, onStartGenerating?: (siteName: string) => void, isAuthed?: boolean, onRequireAuth?: () => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [enhanceState, enhanceFormAction, isEnhancing] = useActionState<EnhanceState, FormData>(enhancePromptAction, initialEnhanceState);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [model, setModel] = useState<string>('googleai/gemini-2.5-flash');

  const typeOptions = [
    { id: 'game', label: 'Social Casino Game', value: 'Game' },
    { id: 'sport-bar', label: 'Sport Bar Ranking (PL)', value: 'Sport bar Poland' },
  ];
  
  useEffect(() => {
    if (!state.success && state.error && !state.fieldErrors) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: state.error,
      });
    }
  }, [state, toast]);

  useEffect(() => {
    if (enhanceState.success && enhanceState.enhancedPrompt) {
        setPrompt(enhanceState.enhancedPrompt);
        toast({
            title: 'Prompt Enhanced',
            description: 'Your prompt has been enhanced with new ideas!',
        });
    } else if (!enhanceState.success && enhanceState.error) {
        toast({
            variant: 'destructive',
            title: 'Enhancement Failed',
            description: enhanceState.error || 'Could not enhance the prompt.',
        });
    }
  }, [enhanceState, toast]);

  useEffect(() => {
    const initialType = state.site?.types?.[0];
    setSelectedType(initialType ?? null);
  }, [state.site?.types]);

  useEffect(() => {
    // hydrate model from localStorage or use current server model
    try {
      const saved = window.localStorage.getItem('wg-model');
      setModel(saved || modelName || 'googleai/gemini-2.5-flash');
    } catch {
      setModel(modelName || 'googleai/gemini-2.5-flash');
    }
  }, [modelName]);

  // No ETA/timer logic — keep UI simple and responsive

  return (
    <div className="w-full max-w-2xl">
      <Card className="w-full shadow-2xl backdrop-blur-lg bg-black/40 border border-white/10">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <Image
              src="/favicon.ico"
              alt="WebGenius"
              width={44}
              height={44}
              className="rounded-xl shadow-[0_12px_28px_rgba(120,90,255,0.35)]"
              priority
            />
            <CardTitle className="sr-only">WebGenius</CardTitle>
          </div>
          <CardDescription className="font-body text-lg">
            Generate a unique, responsive website from a single prompt.
          </CardDescription>
          <p className="text-xs text-muted-foreground mt-2">Model (current): {model}</p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-8" onSubmit={(e) => {
            const data = new FormData(e.currentTarget);
            const name = String(data.get('siteName') || '').trim();
            if (onStartGenerating) onStartGenerating(name || prompt || '');
            try { window.localStorage.setItem('wg-model', model); } catch {}
          }}>
            <input type="hidden" name="history" value={JSON.stringify(state.site?.history || [])} />
            <input type="hidden" name="model" value={model} />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteName" className="text-base">Site Name</Label>
                <Input
                  id="siteName"
                  name="siteName"
                  defaultValue={state.site?.domain || ''}
                  placeholder="e.g., My Awesome Coffee Shop"
                  className="text-base bg-black/25 border border-white/10 focus-visible:ring-0 focus-visible:border-white/10"
                  required
                  autoComplete="off"
                />
                {state.fieldErrors?.siteName && <p className="text-sm font-medium text-destructive">{state.fieldErrors.siteName.join(', ')}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-base">Website Prompt</Label>
                <div className="relative">
                    <Textarea
                        id="prompt"
                        name="prompt"
                        placeholder="e.g., A minimalist coffee shop in Tokyo specializing in single-origin beans."
                        className="min-h-[120px] text-base pr-12 no-scrollbar bg-black/25 border border-white/10 focus-visible:ring-0 focus-visible:border-white/10"
                        required
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        autoComplete="off"
                      />
                     <Button 
                        formAction={enhanceFormAction}
                        type="submit"
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-primary"
                        disabled={isEnhancing}
                        title="Enhance Prompt"
                    >
                        {isEnhancing ? <Wand2 className="h-5 w-5 animate-pulse" /> : <Wand2 className="h-5 w-5" />}
                    </Button>
                </div>
                 <div className="flex justify-between items-center">
                    {state.fieldErrors?.prompt ? (
                        <p className="text-sm font-medium text-destructive">{state.fieldErrors.prompt.join(', ')}</p>
                    ) : <div />}
                    <p className="text-sm text-muted-foreground text-right w-full">Characters: {prompt.length}</p>
                 </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-base">AI Model</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => setModel('googleai/gemini-2.5-flash')}
                    className={cn('rounded-lg px-3 py-2 border text-sm', model === 'googleai/gemini-2.5-flash' ? 'border-primary text-white bg-primary/30' : 'border-white/10 text-white/80 bg-white/5')}>2.5 Flash</button>
                  <button type="button" onClick={() => setModel('googleai/gemini-2.5-pro')}
                    className={cn('rounded-lg px-3 py-2 border text-sm', model === 'googleai/gemini-2.5-pro' ? 'border-primary text-white bg-primary/30' : 'border-white/10 text-white/80 bg-white/5')}>2.5 Pro</button>
                </div>
              </div>

               <div className="space-y-3 pt-2">
                <Label className="text-base">Website Type (Optional)</Label>
                <input type="hidden" name="websiteTypes" value={selectedType ?? ''} disabled={!selectedType} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {typeOptions.map((option) => {
                    const isActive = selectedType === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedType((prev) => (prev === option.value ? null : option.value))}
                        className={cn(
                          'group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white/80 transition-all duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          isActive
                            ? 'border-transparent bg-gradient-to-r from-[#7f5af0]/75 via-[#5a31f0]/70 to-[#050109]/90 text-white shadow-[0_18px_40px_rgba(106,90,255,0.35)]'
                            : ''
                        )}
                        aria-pressed={isActive}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-all duration-200',
                              isActive
                                ? 'border-white bg-white text-black shadow-[0_8px_18px_rgba(255,255,255,0.35)]'
                                : 'text-transparent group-hover:text-white/70'
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="tracking-tight">{option.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
            <div className="space-y-3">
              <SubmitButton isPending={isPending} isAuthed={isAuthed} onRequireAuth={onRequireAuth} />
              {isPending ? (
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-pulse bg-primary/70" />
                </div>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
