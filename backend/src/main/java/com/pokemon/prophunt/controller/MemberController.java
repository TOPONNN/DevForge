package com.pokemon.prophunt.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pokemon.prophunt.dto.MemberLoginRequest;
import com.pokemon.prophunt.dto.MemberRegisterRequest;
import com.pokemon.prophunt.dto.MemberResponse;
import com.pokemon.prophunt.service.MemberService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/members")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @PostMapping("/register")
    public ResponseEntity<MemberResponse> register(@Valid @RequestBody MemberRegisterRequest request) {
        return ResponseEntity.ok(memberService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<MemberResponse> login(@Valid @RequestBody MemberLoginRequest request) {
        return ResponseEntity.ok(memberService.login(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MemberResponse> getProfile(@PathVariable Long id) {
        return ResponseEntity.ok(memberService.getProfile(id));
    }
}
