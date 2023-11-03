package com.portfolio.citadel.domain;


import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.*;
import java.util.stream.Collectors;

@Getter
@Slf4j
public class PlayerWrapper {

    private List<Player> playerList;

    public PlayerWrapper() {
        this.playerList = new ArrayList<>();
        for(int i=1; i<=6; i++) {
            this.playerList.add(new Player(i, i==1));
        }
    }

    public PlayerWrapper(int memberCount) {
        this.playerList = new ArrayList<>();
        for(int i=1; i<=memberCount; i++) {
            this.playerList.add(new Player(i, i==1));
        }
    }

    public List<Player> getPlayerList() {
        return this.playerList;
    }

    private void sortByCrown() {

        // 기본적으로 PlayerNo 기준 정렬하되, 왕관을 가진 플레이어부터 정렬
        this.playerList = this.playerList.stream().sorted(Comparator.comparingInt(Player::getNo)).collect(Collectors.toList());
        Queue<Player> playerQueue = new LinkedList<>(this.playerList);
        while(!playerQueue.peek().isCrown()) {
            playerQueue.offer(playerQueue.poll());
        }
        this.playerList = playerQueue.stream().toList();
    }

    public void chooseJob(List<Job> jobList) {

        List<Job> jobListCopied = new ArrayList<>(jobList);

        this.sortByCrown();
        for(Player p : this.playerList) {
            int jobIndex = (int)(Math.random() * jobListCopied.size());

            Job selected = jobListCopied.get(jobIndex);
            p.setJob(selected);
            jobListCopied.remove(selected);

            log.info(String.format("Player%d가 %s를 선택했습니다", p.getNo(), p.getJob().getName()));
        }
    }
}
