'use client';

import { useEffect, useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { enhancePromptAction } from '@/app/actions';
import { Checkbox } from './ui/checkbox';

function SubmitButton({ isPending, isAuthed, onRequireAuth }: { isPending: boolean; isAuthed: boolean; onRequireAuth?: () => void }) {
  return (
    <Button
      type={isAuthed ? "submit" : "button"}
      onClick={!isAuthed ? onRequireAuth : undefined}
      disabled={isPending}
      className="w-full text-lg py-6 font-headline"
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

const initialEnhanceState = {
  success: false,
  error: null,
  enhancedPrompt: '',
};

export function SiteGeneratorForm({ formAction, isPending, state, modelName, onStartGenerating, isAuthed = true, onRequireAuth }: { formAction: (payload: FormData) => void, isPending: boolean, state: any, modelName: string, onStartGenerating?: (siteName: string) => void, isAuthed?: boolean, onRequireAuth?: () => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [enhanceState, enhanceFormAction, isEnhancing] = useActionState(enhancePromptAction, initialEnhanceState);
  
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

  return (
    <div className="w-full max-w-2xl">
      <Card className="w-full shadow-2xl backdrop-blur-lg bg-black/40 border border-white/10">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-4xl tracking-tight">
              WebGenius
            </CardTitle>
          </div>
          <CardDescription className="font-body text-lg">
            Generate a unique, responsive website from a single prompt.
          </CardDescription>
          <p className="text-xs text-muted-foreground mt-2">Model: {modelName}</p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-8" onSubmit={(e) => {
            const data = new FormData(e.currentTarget);
            const name = String(data.get('siteName') || '').trim();
            if (onStartGenerating) onStartGenerating(name || prompt || '');
          }}>
            <input type="hidden" name="history" value={JSON.stringify(state.site?.history || [])} />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteName" className="text-base">Site Name</Label>
                <Input
                  id="siteName"
                  name="siteName"
                  defaultValue={state.site?.domain || ''}
                  placeholder="e.g., My Awesome Coffee Shop"
                  className="text-base bg-black/20 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50"
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
                        className="min-h-[120px] text-base pr-12 no-scrollbar bg-black/20 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50"
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
              
               <div className="space-y-3 pt-2">
                <Label className="text-base">Website Type (Optional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Label
                    htmlFor="game"
                    className="flex items-center gap-3 rounded-lg border-2 border-muted bg-popover/50 p-4 cursor-pointer transition-colors hover:bg-accent/10 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <Checkbox id="game" name="websiteTypes" value="Game" className="h-5 w-5" />
                    <span className="font-medium">Social Casino Game</span>
                  </Label>
                  <Label
                    htmlFor="sport-bar"
                    className="flex items-center gap-3 rounded-lg border-2 border-muted bg-popover/50 p-4 cursor-pointer transition-colors hover:bg-accent/10 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <Checkbox id="sport-bar" name="websiteTypes" value="Sport bar Poland" className="h-5 w-5" />
                    <span className="font-medium">Sport Bar Ranking (PL)</span>
                  </Label>
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
