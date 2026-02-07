-- Wipe all existing flashcard data (cascades to flashcards → user_flashcard_progress)
DELETE FROM public.flashcard_decks;

-- ============================================================
-- TECHNICALS (18 decks)
-- ============================================================
INSERT INTO public.flashcard_decks (track, category, description) VALUES
  ('technicals', 'Accounting & Financial Statements - Core', 'Fundamental accounting concepts: income statement, balance sheet, cash flow statement, and how they link together.'),
  ('technicals', 'Accounting & Financial Statements - Advanced', 'Complex accounting topics: deferred taxes, goodwill impairment, lease accounting, and non-recurring items.'),
  ('technicals', 'Working Capital & Cash Flow', 'Net working capital changes, free cash flow calculations, and their impact on valuation.'),
  ('technicals', 'Valuation Fundamentals', 'Core valuation methodologies, when to use each approach, and key valuation principles.'),
  ('technicals', 'Comparable Company Analysis', 'Trading comps methodology: selecting peers, relevant multiples, and interpreting results.'),
  ('technicals', 'Precedent Transactions', 'Transaction comps methodology: sourcing deals, control premiums, and comparing to trading comps.'),
  ('technicals', 'Equity Value vs Enterprise Value', 'Bridge between equity and enterprise value, treatment of different securities, and common pitfalls.'),
  ('technicals', 'DCF - Core Concepts', 'Discounted cash flow fundamentals: unlevered FCF, discount rates, and projection periods.'),
  ('technicals', 'DCF - WACC & Terminal Value', 'Weighted average cost of capital components, terminal value approaches, and sensitivity analysis.'),
  ('technicals', 'DCF - Advanced & Edge Cases', 'Mid-year convention, stub periods, negative cash flows, and sector-specific DCF adjustments.'),
  ('technicals', 'M&A Fundamentals', 'Mergers & acquisitions basics: strategic rationale, deal process, and key considerations.'),
  ('technicals', 'M&A Accretion/Dilution', 'Accretion/dilution analysis: EPS impact, purchase price allocation, and pro forma adjustments.'),
  ('technicals', 'M&A Deal Structures & Synergies', 'Stock vs cash deals, synergy types and estimation, and transaction structuring.'),
  ('technicals', 'M&A Advanced Topics', 'Complex M&A scenarios: hostile takeovers, spin-offs, activist situations, and cross-border deals.'),
  ('technicals', 'LBO Fundamentals', 'Leveraged buyout basics: ideal LBO candidates, capital structure, and sources & uses.'),
  ('technicals', 'LBO Returns & Exit Strategies', 'IRR and MOIC drivers, exit multiples, dividend recaps, and return attribution.'),
  ('technicals', 'LBO Advanced Modeling', 'Complex LBO topics: PIK debt, management rollover, covenant analysis, and add-on acquisitions.'),
  ('technicals', 'Debt & Leverage', 'Debt instruments, leverage ratios, credit analysis, and capital structure optimization.');

-- ============================================================
-- BEHAVIORALS (25 decks)
-- ============================================================
INSERT INTO public.flashcard_decks (track, category, description) VALUES
  ('behaviorals', 'Story & Motivation - Walk Me Through Your Resume', 'Crafting a compelling 2-minute resume walkthrough that connects your experiences to banking.'),
  ('behaviorals', 'Story & Motivation - Why Investment Banking', 'Articulating genuine motivation for IB beyond prestige and compensation.'),
  ('behaviorals', 'Story & Motivation - Why This Firm', 'Firm-specific research, culture fit, and differentiating between banks.'),
  ('behaviorals', 'Career Goals & Long-Term Vision', 'Short-term and long-term career goals, exit opportunities, and professional development.'),
  ('behaviorals', 'Leadership & Initiative - Leading Teams', 'Examples of leading teams, delegating effectively, and inspiring others.'),
  ('behaviorals', 'Leadership & Initiative - Taking Ownership', 'Demonstrating initiative, going above and beyond, and owning outcomes.'),
  ('behaviorals', 'Leadership & Initiative - Driving Results', 'Achieving measurable impact, setting goals, and delivering under constraints.'),
  ('behaviorals', 'Teamwork & Collaboration', 'Working effectively in teams, contributing to group success, and supporting teammates.'),
  ('behaviorals', 'Conflict Resolution & Difficult People', 'Handling disagreements, managing difficult personalities, and finding common ground.'),
  ('behaviorals', 'Group Dynamics & Contributing to Teams', 'Understanding team roles, adapting your style, and adding value in group settings.'),
  ('behaviorals', 'Failure & Learning from Mistakes', 'Discussing failures constructively, demonstrating growth, and showing self-awareness.'),
  ('behaviorals', 'Weaknesses & Self-Improvement', 'Honest self-assessment, active improvement strategies, and turning weaknesses into strengths.'),
  ('behaviorals', 'Receiving & Acting on Feedback', 'Accepting constructive criticism, implementing changes, and seeking feedback proactively.'),
  ('behaviorals', 'Work Ethic & Managing Long Hours', 'Demonstrating commitment, stamina, and strategies for sustaining high performance.'),
  ('behaviorals', 'Handling Pressure & Tight Deadlines', 'Performing under stress, managing urgent deliverables, and staying composed.'),
  ('behaviorals', 'Prioritization & Time Management', 'Juggling multiple tasks, setting priorities, and managing competing deadlines.'),
  ('behaviorals', 'Communication & Presentation Skills', 'Clear communication, presenting to stakeholders, and adapting your message to the audience.'),
  ('behaviorals', 'Attention to Detail & Quality', 'Ensuring accuracy, catching errors, and maintaining high standards in deliverables.'),
  ('behaviorals', 'Client Interaction & Professionalism', 'Client-facing skills, building relationships, and maintaining professionalism.'),
  ('behaviorals', 'Deal Experience & Stock Pitches', 'Discussing deals you have followed, structuring stock pitches, and demonstrating market awareness.'),
  ('behaviorals', 'Market Knowledge & Current Events', 'Staying informed on markets, discussing recent deals, and understanding macro trends.'),
  ('behaviorals', 'Industry & Sector Knowledge', 'Sector-specific knowledge, industry drivers, and demonstrating genuine interest in a coverage area.'),
  ('behaviorals', 'Brain Teasers & Problem Solving', 'Logical reasoning, mental math, and structured approaches to open-ended problems.'),
  ('behaviorals', 'Ethical Dilemmas & Integrity', 'Navigating ethical situations, maintaining integrity, and handling confidential information.'),
  ('behaviorals', 'Culture Fit & Diversity Questions', 'Contributing to firm culture, diversity and inclusion perspectives, and what you bring to the team.');
