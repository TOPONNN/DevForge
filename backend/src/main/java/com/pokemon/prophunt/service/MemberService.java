package com.pokemon.prophunt.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.pokemon.prophunt.dto.MemberLoginRequest;
import com.pokemon.prophunt.dto.MemberRegisterRequest;
import com.pokemon.prophunt.dto.MemberResponse;
import com.pokemon.prophunt.entity.Member;
import com.pokemon.prophunt.repository.MemberRepository;

@Service
public class MemberService {

    private final MemberRepository memberRepository;

    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Transactional
    public MemberResponse register(MemberRegisterRequest request) {
        if (memberRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already exists");
        }

        Member member = new Member();
        member.setUsername(request.getUsername());
        member.setPassword(request.getPassword());
        member.setNickname(request.getNickname());

        return toResponse(memberRepository.save(member));
    }

    @Transactional(readOnly = true)
    public MemberResponse login(MemberLoginRequest request) {
        Member member = memberRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!member.getPassword().equals(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        return toResponse(member);
    }

    @Transactional(readOnly = true)
    public MemberResponse getProfile(Long memberId) {
        Member member = memberRepository.findById(memberId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
        return toResponse(member);
    }

    @Transactional
    public void updateStats(Long memberId, boolean won, int catches) {
        Member member = memberRepository.findById(memberId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        member.setTotalGames(member.getTotalGames() + 1);
        if (won) {
            member.setTotalWins(member.getTotalWins() + 1);
        }
        member.setTotalCatches(member.getTotalCatches() + Math.max(catches, 0));
    }

    private MemberResponse toResponse(Member member) {
        return new MemberResponse(
            member.getId(),
            member.getNickname(),
            member.getTotalGames(),
            member.getTotalWins(),
            member.getTotalCatches());
    }
}
