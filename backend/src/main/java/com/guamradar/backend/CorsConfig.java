package com.guamradar.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

  @Value("${CORS_ALLOWED_ORIGINS:https://guamradar.com,https://www.guamradar.com}")
  private String allowedOrigins;

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
      .allowedOrigins(allowedOrigins.split(","))
      .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
      .allowedHeaders("*");
  }
}

