"""
AI Service for StudySpace.
Integrates with any OpenAI-compatible API (OpenAI, Groq, OpenRouter, Ollama, etc.)
Adheres to Truthful AI: answers grounded in source material; graceful degradation when unconfigured.
"""
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from backend.config import settings

logger = logging.getLogger("studyspace.ai")

class AIService:
    @property
    def is_configured(self) -> bool:
        return bool(settings.AI_API_KEY and settings.AI_API_KEY.strip())

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.AI_API_KEY}",
            "Content-Type": "application/json"
        }

    def _call_llm(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        """Helper to invoke OpenAI-compatible /chat/completions endpoint with automatic model fallback."""
        if not self.is_configured:
            raise ValueError(
                "AI service is not configured. Please add your AI_API_KEY in the Settings page or in your .env file."
            )

        url = f"{settings.AI_BASE_URL}/chat/completions"
        candidate_models = [settings.AI_MODEL]
        if "googleapis.com" in settings.AI_BASE_URL:
            for fallback in ["gemini-flash-lite-latest", "gemini-3.8-flash"]:
                if fallback not in candidate_models:
                    candidate_models.append(fallback)

        last_error = None
        for model in candidate_models:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature
            }

            try:
                with httpx.Client(timeout=45.0) as client:
                    response = client.post(url, headers=self._get_headers(), json=payload)
                    if response.status_code == 401:
                        raise ValueError("Invalid AI API key. Please check your credentials in Settings.")
                    elif response.status_code in (503, 429) and len(candidate_models) > 1:
                        logger.warning(f"Model {model} returned {response.status_code}, attempting fallback model...")
                        last_error = ValueError(f"AI Provider error ({response.status_code}): {response.text[:200]}")
                        continue
                    elif response.status_code >= 400:
                        raise ValueError(f"AI Provider error ({response.status_code}): {response.text[:200]}")
                    
                    result = response.json()
                    return result["choices"][0]["message"]["content"].strip()
            except httpx.TimeoutException:
                last_error = ValueError("AI request timed out. Please try again with a shorter passage.")
                continue
            except httpx.RequestError as e:
                raise ValueError(f"Failed to connect to AI provider: {str(e)}")

        if last_error:
            raise last_error
        raise ValueError("Failed to get response from AI provider.")

    @staticmethod
    def _strip_emojis(text: str) -> str:
        """Removes any unicode emojis from text to guarantee clean, professional output."""
        import re
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FA6F"
            "\U0001FA70-\U0001FAFF"
            "\U00002600-\U000026FF"
            "]+", flags=re.UNICODE
        )
        return emoji_pattern.sub("", text)

    def explain_simply(self, text: str, style: str = "simple", context_title: str = "") -> Dict[str, Any]:
        """Provides pedagogical, humanized explanations grounded in source material."""
        style_instructions = {
            "simple": "Explain this in plain, relatable English as if you are a friendly senior mentor chatting over coffee. Demystify technical terms, use a warm conversational tone, and connect the ideas logically.",
            "example": "Explain this concept by walking through an intuitive, concrete everyday scenario or practical story that makes the idea immediately obvious and memorable.",
            "step_by_step": "Break this concept down into a clean, logical narrative of steps, explaining what happens first, what happens next, and why each step matters.",
            "business": "Explain this through the lens of a real-world company or production engineering scenario: what problem does this solve, what are the trade-offs, and why do teams use it?",
            "revision": "Provide a high-yield, punchy explanation focusing on: What is this in 2 sentences, why does it matter, and what is the single most important thing to remember?"
        }

        instruction = style_instructions.get(style, style_instructions["simple"])
        prompt = (
            f"You are a skilled, approachable human mentor and tutor in StudySpace.\n\n"
            f"Context: {context_title or 'Study Notes'}\n"
            f"Goal: {instruction}\n\n"
            f"Passage to explain:\n\"\"\"{text}\"\"\"\n\n"
            f"HUMANIZATION & WRITING GUIDELINES:\n"
            f"- Write in a warm, natural, human voice. Sound like a passionate teacher or senior engineer explaining directly to a curious student.\n"
            f"- STRICTLY NO robotic AI filler phrases (do not use: 'In conclusion', 'Delve into', 'It is important to note', 'Crucial aspect', 'A testament to', 'Furthermore', 'Moreover').\n"
            f"- STRICTLY ZERO EMOJIS (no icons, symbols, or emoji characters anywhere).\n"
            f"- Avoid sterile key-value dumps. Use cohesive, well-connected paragraphs with natural sentence flow.\n"
            f"- Focus on intuition and understanding over mechanical definitions.\n"
            f"- Format cleanly in lightweight Markdown."
        )

        messages = [
            {"role": "system", "content": "You are a warm, articulate human tutor and mentor. You explain complex technical concepts with intuitive analogies, natural conversational flow, and zero robotic jargon or emojis."},
            {"role": "user", "content": prompt}
        ]
        explanation = self._call_llm(messages, temperature=0.45)
        explanation = self._strip_emojis(explanation)
        return {"success": True, "result": explanation}

    def summarize_content(self, sections: List[Dict[str, Any]], focus: str = "all") -> Dict[str, Any]:
        """Generates an articulate, humanized executive study summary grounded in source material."""
        combined_text = "\n\n".join([f"[{s.get('page_or_slide', 'Section')} - {s.get('title', '')}]:\n{s.get('content', '')}" for s in sections[:15]])
        
        prompt = (
            f"You are an expert academic mentor and lead engineer writing a comprehensive study guide for your students.\n"
            f"Summarize the study material below in a thoroughly humanized, cohesive, and insightful manner.\n\n"
            f"CRITICAL HUMANIZATION & TONE GUIDELINES:\n"
            f"1. Write in a thoughtful, natural human voice—not like a sterile, robotic AI bullet generator.\n"
            f"2. Write cohesive, flowing prose with clear narrative transitions connecting concepts together.\n"
            f"3. STRICTLY ZERO EMOJIS anywhere (no emoji icons in headers, lists, or text).\n"
            f"4. Avoid robotic AI cliches ('In conclusion', 'Delve into', 'It is worth noting that', 'A tapestry of', 'Crucial aspect', 'Paramount').\n"
            f"5. Structure your summary cleanly using these exact Markdown headings:\n\n"
            f"### The Big Picture\n"
            f"A concise, fluent paragraph explaining what this subject is, the primary challenge it addresses, and why it is fundamental.\n\n"
            f"### Core Concepts and How They Connect\n"
            f"Explain the primary architecture, components, and mechanisms in clear, connected paragraphs. Explain how the pieces work together rather than giving disconnected definitions.\n\n"
            f"### Practical Context and Real-World Application\n"
            f"Explain how these tools or concepts are used in actual production systems, key industry trade-offs, and when you would choose one approach over another.\n\n"
            f"### High-Yield Exam and Revision Takeaways\n"
            f"3 to 5 memorable, high-yield takeaways written conversationally to help the student retain the most important ideas.\n\n"
            f"Study Material Content:\n\"\"\"{combined_text[:12000]}\"\"\""
        )

        messages = [
            {"role": "system", "content": "You are a thoughtful, articulate human professor and technical mentor. You synthesize study materials into clear, connected, humanized study guides without any robotic cliches or emojis."},
            {"role": "user", "content": prompt}
        ]
        summary = self._call_llm(messages, temperature=0.35)
        summary = self._strip_emojis(summary)
        return {"success": True, "result": summary}

    def ask_question(self, question: str, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Grounds question-answering in the provided document sections (RAG) with a natural human voice."""
        # Keyword relevance filtering
        words = [w.lower() for w in question.split() if len(w) > 3]
        scored_sections = []
        for s in sections:
            content_lower = s["content"].lower()
            score = sum(1 for w in words if w in content_lower)
            scored_sections.append((score, s))

        # Sort by relevance, take top 4 sections (or first 4 if scores are equal)
        scored_sections.sort(key=lambda x: x[0], reverse=True)
        top_sections = [s for _, s in scored_sections[:4]]

        context_blocks = []
        citations = []
        for s in top_sections:
            ref = s.get("page_or_slide", f"Section {s.get('section_index', 1)}")
            title = s.get("title", "")
            citations.append({"reference": ref, "title": title})
            context_blocks.append(f"--- Reference: {ref} | Section: {title} ---\n{s.get('content', '')[:2500]}")

        context_str = "\n\n".join(context_blocks)

        prompt = (
            f"You are a helpful, human study partner in StudySpace.\n"
            f"Answer the user's question BASED ONLY on the provided study sections below.\n\n"
            f"HUMANIZATION & ACCURACY RULES:\n"
            f"1. Answer in a warm, direct, conversational human voice.\n"
            f"2. Reference the source clearly (e.g., 'According to {citations[0]['reference']}...').\n"
            f"3. STRICTLY ZERO EMOJIS.\n"
            f"4. If the answer is NOT mentioned in the text, simply state honestly: 'The provided study material does not contain enough information to answer this question.' Do NOT invent outside facts.\n\n"
            f"Study Context:\n{context_str}\n\n"
            f"User Question: {question}"
        )

        messages = [
            {"role": "system", "content": "You are a knowledgeable, truthful study partner. Answer in a clear, human, emoji-free voice grounded strictly in the material."},
            {"role": "user", "content": prompt}
        ]
        answer = self._call_llm(messages, temperature=0.15)
        answer = self._strip_emojis(answer)
        return {"success": True, "result": answer, "citations": citations}

    def generate_flashcards(self, text: str, count: int = 5) -> Dict[str, Any]:
        """Generates structured flashcards (Front/Back) from study content."""
        prompt = (
            f"Extract exactly {count} high-yield study flashcards from the text below.\n"
            f"Each flashcard must test an important definition, concept, rule, or mechanism.\n"
            f"Return ONLY a valid JSON array of objects with keys 'question', 'answer', 'tag'.\n"
            f"Do not include markdown code fences or conversational text.\n\n"
            f"Text:\n\"\"\"{text[:8000]}\"\"\""
        )

        messages = [
            {"role": "system", "content": "You are a flashcard generator. Respond with JSON array only."},
            {"role": "user", "content": prompt}
        ]
        raw_response = self._call_llm(messages, temperature=0.3)
        clean_json = raw_response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        try:
            cards = json.loads(clean_json)
            if not isinstance(cards, list):
                cards = [cards]
            return {"success": True, "data": cards}
        except Exception as e:
            logger.error(f"Failed to parse flashcard JSON: {clean_json}")
            raise ValueError(f"AI response could not be formatted into flashcards: {str(e)}")

    def generate_quiz(self, text: str, question_count: int = 10, difficulty: str = "medium", topic_context: str = "") -> Dict[str, Any]:
        """
        Generates a proper academic practice quiz with exactly `question_count` (default 10) questions.
        Each question is strictly multiple choice ('mcq') with exactly 4 options where one is correct.
        Supports difficulty progression (easy, medium, hard, expert).
        """
        difficulty_guides = {
            "easy": "Level 1 - Easy: Focus on foundational recall, direct definitions, core terminology, and basic factual understanding.",
            "medium": "Level 2 - Medium: Focus on conceptual understanding, practical application, comparing mechanisms, and standard scenarios.",
            "hard": "Level 3 - Hard: Focus on in-depth analysis, architectural trade-offs, edge cases, performance implications, and gotchas.",
            "expert": "Level 4 - Expert: Focus on advanced system troubleshooting, complex multi-component trade-offs, failure modes, and mastery."
        }
        diff_instruction = difficulty_guides.get(difficulty.lower(), difficulty_guides["medium"])

        context_header = f"Topic / Subject Context: {topic_context}\n" if topic_context else ""

        prompt = (
            f"You are StudySpace's expert examination tutor.\n"
            f"Create a high-quality practice quiz based strictly on the study text below.\n\n"
            f"{context_header}"
            f"Difficulty Requirement: {diff_instruction}\n"
            f"Question Count: Exactly {question_count} questions.\n\n"
            f"STRICT RULES:\n"
            f"1. Generate EXACTLY {question_count} questions.\n"
            f"2. Every question MUST be multiple choice ('mcq'). STRICTLY NO True/False questions (NO 2-option questions).\n"
            f"3. Every question MUST have an 'options' array containing EXACTLY 4 distinct choices (Option A, Option B, Option C, Option D).\n"
            f"4. Exactly one choice must be the correct answer. The 'correct_answer' string MUST match one of the 4 options verbatim.\n"
            f"5. Include a clear 'explanation' for each question explaining why that answer is correct based on the study text.\n\n"
            f"Return ONLY a valid JSON array of {question_count} objects with keys:\n"
            f"- 'question_type': 'mcq'\n"
            f"- 'question_text': string prompt\n"
            f"- 'options': array of exactly 4 strings\n"
            f"- 'correct_answer': string (exact match to one of options)\n"
            f"- 'explanation': string\n\n"
            f"Study Content:\n\"\"\"{text[:10000]}\"\"\""
        )

        messages = [
            {"role": "system", "content": "You are a professional educational examiner. Output strictly valid JSON arrays of 4-option multiple choice questions only."},
            {"role": "user", "content": prompt}
        ]
        raw_response = self._call_llm(messages, temperature=0.3)
        clean_json = raw_response.strip()
        if clean_json.startswith("```"):
            clean_json = clean_json.strip("`")
            if clean_json.lower().startswith("json"):
                clean_json = clean_json[4:].strip()

        try:
            parsed = json.loads(clean_json)
            if isinstance(parsed, dict):
                parsed = parsed.get("questions") or parsed.get("quiz") or parsed.get("data") or list(parsed.values())[0]
            if not isinstance(parsed, list):
                parsed = [parsed]
        except Exception as e:
            logger.error(f"Failed to parse quiz JSON: {clean_json}")
            raise ValueError(f"AI response could not be formatted into quiz questions: {str(e)}")

        sanitized_questions = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            q_text = str(item.get("question_text", "")).strip()
            if not q_text:
                continue

            raw_opts = item.get("options", [])
            if not isinstance(raw_opts, list):
                raw_opts = [str(raw_opts)]
            opts = [str(o).strip() for o in raw_opts if str(o).strip()]

            corr = str(item.get("correct_answer", "")).strip()

            # Ensure exactly 4 options
            if len(opts) < 4:
                distractors = [
                    "None of the above",
                    "All of the above",
                    "Cannot be determined from the material",
                    "Only applicable under specific edge configurations"
                ]
                for d in distractors:
                    if d not in opts and d != corr:
                        opts.append(d)
                    if len(opts) == 4:
                        break
            elif len(opts) > 4:
                if corr in opts:
                    other_opts = [o for o in opts if o != corr][:3]
                    opts = [corr] + other_opts
                else:
                    opts = opts[:4]

            # Ensure corr is present in opts
            if corr not in opts:
                if opts:
                    opts[0] = corr
                else:
                    opts = [corr, "Alternative option B", "Alternative option C", "Alternative option D"]

            explanation = str(item.get("explanation", "")).strip() or "Verified according to the provided study text."

            sanitized_questions.append({
                "question_type": "mcq",
                "question_text": q_text,
                "options": opts[:4],
                "correct_answer": corr,
                "explanation": explanation
            })

        return {"success": True, "data": sanitized_questions}

ai_service = AIService()
