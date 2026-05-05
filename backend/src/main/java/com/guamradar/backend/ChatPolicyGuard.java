package com.guamradar.backend;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ChatPolicyGuard {
  private static final String CODE_REQUEST_REPLY = """
    I can help with Guam-related places, planning, local discovery, and plain-language comparisons, but I can't generate code, scripts, API clients, scraping instructions, or developer walkthroughs here.

    If you want, tell me the Guam village or type of place you care about and I'll help compare options in normal travel-planning terms.
    """;

  private static final List<Pattern> CODE_REQUEST_PATTERNS = List.of(
    Pattern.compile("\\b(write|make|create|build|generate|give me|show me)\\b.{0,40}\\b(code|script|program|app|bot|crawler|scraper)\\b"),
    Pattern.compile("\\b(python|javascript|typescript|java|node|react|curl|requests|beautifulsoup|selenium|playwright)\\b"),
    Pattern.compile("\\b(api client|api key|google places api|yelp fusion api|places api|endpoint|json|sdk|oauth|token)\\b"),
    Pattern.compile("\\b(scrape|scraping|crawl|crawler|automate|automation|bypass)\\b")
  );

  public String blockedReply(ChatRequest request) {
    String latestUserMessage = latestUserMessage(request);
    if (latestUserMessage.isBlank()) {
      return null;
    }

    String normalized = latestUserMessage.toLowerCase(Locale.ROOT);
    for (Pattern pattern : CODE_REQUEST_PATTERNS) {
      if (pattern.matcher(normalized).find()) {
        return CODE_REQUEST_REPLY.trim();
      }
    }

    return null;
  }

  private String latestUserMessage(ChatRequest request) {
    if (request == null || request.messages() == null || request.messages().isEmpty()) {
      return "";
    }

    for (int i = request.messages().size() - 1; i >= 0; i--) {
      ChatMessage message = request.messages().get(i);
      if (message != null && message.role() != null && message.role().equalsIgnoreCase("user")) {
        return message.content() == null ? "" : message.content();
      }
    }

    return "";
  }
}
